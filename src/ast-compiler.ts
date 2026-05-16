import { ExprNode } from "./ast.js";
import { ExecutionPlan } from "./executor.js";
import { COMPILED_GRAPH, DEPS, EXEC_GRAPH } from "./symbols.js";
import { ExecutionFrame } from "./types.js";
import { StepDef, WorkflowDef } from "./workflow-composer.js";

export type ResultsArray = any[];

type SlotMap = Map<number, number>;

export type CompiledStep = {
  id: string;
  idx: number; // graph id (debug)
  slot: number; // VM register index (runtime)
  deps: number[];
  guards: number[];
  run: CompiledStepRuntime;
};

export type StepRuntimeCtx = {
  input: any;
  pipeIter: number | undefined;
  results: any[][];
  observers: any[];
  frame?: ExecutionFrame;
};

export type CompiledStepRuntime = (ctx: StepRuntimeCtx) => Promise<any>;

export type CompiledExpr = (ctx: StepRuntimeCtx) => any | Promise<any>;

export type CompilerCtx<S = any, M = any> = {
  services: S;
  meta: M;
};

export function getIter(rt: StepRuntimeCtx): number {
  return rt.pipeIter ?? 0;
}

export function ensureSlot(results: any[][], slot: number) {
  results[slot] ??= [];
}

export function writeResult(rt: StepRuntimeCtx, slot: number, value: any) {
  const iter = getIter(rt);

  ensureSlot(rt.results, slot);

  rt.results[slot][iter] = value;
}

export function readResult(rt: StepRuntimeCtx, slot: number) {
  const iter = getIter(rt);

  return rt.results[slot]?.[iter];
}

function isExprNode(v: any): v is ExprNode {
  return (
    v &&
    typeof v === "object" &&
    typeof v.type === "string" &&
    (v.type === "const" || v.type === "get" || v.type === "call")
  );
}

// if (isExprNode(value)) {
//   return value; // DO NOT compile here
// }

function compileConst(value: any, ctx: CompilerCtx, slotMap: SlotMap): any {
  if (value == null) return value;

  if (isExprNode(value)) {
    return compileExpr(value, ctx, slotMap);
  }

  if (Array.isArray(value)) {
    return value.map((v) => compileConst(v, ctx, slotMap));
  }

  if (typeof value === "object") {
    const out: any = {};
    for (const k in value) {
      out[k] = compileConst(value[k], ctx, slotMap);
    }
    return out;
  }

  return value;
}

function assignSlots(steps: StepDef<any>[]): SlotMap {
  const map = new Map<number, number>();

  const sorted = [...steps].sort((a, b) => a.idx - b.idx);

  sorted.forEach((s, i) => {
    map.set(s.idx, i);
  });

  return map;
}

async function evalExpr(value: any, rt: StepRuntimeCtx): Promise<any> {
  if (value == null) return value;

  if (typeof value === "function") {
    return value(rt);
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => evalExpr(v, rt)));
  }

  if (typeof value === "object") {
    const out: any = {};

    for (const k in value) {
      out[k] = await evalExpr(value[k], rt);
    }

    return out;
  }

  return value;
}

export function compileExpr(
  node: ExprNode,
  ctx: CompilerCtx,
  slotMap: SlotMap,
): CompiledExpr {
  switch (node.type) {
    case "const": {
      // const compiled = compileConst(node.value, ctx, slotMap);
      // return () => compiled;

      const raw = node.value;
      const compiled = compileConst(raw, ctx, slotMap);
      return (rt) => evalExpr(compiled, rt);
    }

    case "get": {
      const slot = slotMap.get(node.ref);

      if (slot === undefined) {
        throw new Error(`Unknown ref: ${node.ref}`);
      }

      const path = node.path;

      return (rt) => {
        let value = readResult(rt, slot);

        for (const p of path) {
          value = value?.[p];
        }

        return value;
      };
    }

    case "call": {
      const fn = ctx.services[node.service][node.method];
      const args = node.args.map((a) => compileExpr(a, ctx, slotMap));

      const serviceMeta = ctx.meta?.[node.service];
      const methodMeta = serviceMeta?.methods?.[node.method];

      const isAsync =
        serviceMeta?.async === true ||
        methodMeta?.async === true ||
        fn.constructor?.name === "AsyncFunction";

      return async (rt) => {
        const resolved = await Promise.all(args.map((a) => a(rt)));

        const result = fn(...resolved);

        return isAsync ? await result : result;
      };
    }
  }
}

export function compileStep(
  step: StepDef<any>,
  ctx: CompilerCtx,
  slot: number,
  slotMap: SlotMap,
): CompiledStep {
  const resolve = step.resolve ? compileExpr(step.resolve, ctx, slotMap) : null;

  const guards = step.guards ?? [];

  switch (step.spec) {
    case "__init__":
      return {
        id: step.id,
        idx: step.idx,
        slot,
        deps: step.dependsOn,
        guards,

        run: async (rt) => {
          const value = resolve ? await resolve(rt) : rt.input;

          const out = await evalExpr(value, rt);

          writeResult(rt, slot, out);

          return out;
        },
      };

    case "__out__":
      return {
        id: step.id,
        idx: step.idx,
        slot,
        deps: step.dependsOn,
        guards,

        run: async (rt) => {
          const value = resolve ? await resolve(rt) : undefined;

          const out = await evalExpr(value, rt);
          writeResult(rt, slot, out);

          return out;
        },
      };

    case "__join__":
      return {
        id: step.id,
        idx: step.idx,
        slot,
        deps: step.dependsOn,
        guards,

        run: async () => undefined,
      };

    case "__pipe__":
      return {
        id: step.id,
        idx: step.idx,
        slot,
        deps: step.dependsOn,
        guards,

        run: async () => {
          throw new Error("Pipe must be compiled separately");
        },
      };

    default:
      return {
        id: step.id,
        idx: step.idx,
        slot,
        deps: step.dependsOn,
        guards,

        run: async (rt) => {
          const value = resolve ? await resolve(rt) : undefined;

          const out = await evalExpr(value, rt);

          writeResult(rt, slot, out);
          return out;
        },
      };
  }
}

function compilePipeStep(
  step: StepDef<any>,
  ctx: CompilerCtx,
  slot: number,
  slotMap: SlotMap,
): CompiledStep {
  const source = step.resolve ? compileExpr(step.resolve, ctx, slotMap) : null;

  if (!source) {
    throw new Error("Pipe requires resolve");
  }

  if (!step.pipe?.steps?.length) {
    throw new Error("Pipe requires steps");
  }

  const mode = step.pipe.mode ?? "map";

  // -----------------------------------
  // compile inner pipe steps
  // -----------------------------------

  const pipeSteps = step.pipe.steps.map((s) =>
    compileStep(s, ctx, slotMap.get(s.idx)!, slotMap),
  );

  // -----------------------------------
  // execution levels
  // -----------------------------------

  const levels = buildLevels(step.pipe.steps).map((level) =>
    level.map((s) => pipeSteps.find((c) => c.idx === s.idx)!),
  );

  // -----------------------------------
  // terminal pipe step
  // -----------------------------------
  const terminalIdx =
    step.pipe.exitMap?.length === 1
      ? step.pipe.exitMap[0]
      : step.pipe.exitMap?.[step.pipe.exitMap.length - 1];

  const terminalSlot = slotMap.get(terminalIdx)!;

  // -----------------------------------
  // iteration executor
  // -----------------------------------

  async function runIteration(rt: StepRuntimeCtx, item: any, iter: number) {
    rt.input = item;
    rt.pipeIter = iter;

    for (const level of levels) {
      await Promise.all(level.map((s) => s.run(rt)));
    }

    return readResult(rt, terminalSlot);
  }

  // -----------------------------------
  // compiled pipe runtime
  // -----------------------------------

  return {
    id: step.id,
    idx: step.idx,
    slot,
    deps: step.dependsOn,
    guards: step.guards ?? [],

    run: async (rt) => {
      const items = await evalExpr(source(rt), rt);

      const list = Array.isArray(items) ? items : [];

      switch (mode) {
        // -----------------------------------
        // MAP
        // -----------------------------------

        case "map": {
          const res = [];

          for (let i = 0; i < list.length; i++) {
            const out = await runIteration(rt, list[i], i);

            res[i] = out;
          }

          rt.pipeIter = undefined;

          writeResult(rt, slot, res);

          return res;
        }

        case "filter": {
          const res = [];

          for (let i = 0; i < list.length; i++) {
            const out = await runIteration(rt, list[i], i);

            if (out) {
              res.push(list[i]);
            }
          }

          rt.pipeIter = undefined;

          writeResult(rt, slot, res);

          return res;
        }

        // -----------------------------------
        // FIND
        // -----------------------------------

        case "find": {
          for (let i = 0; i < list.length; i++) {
            const out = await runIteration(rt, list[i], i);

            if (out) {
              rt.pipeIter = undefined;

              writeResult(rt, slot, list[i]);

              return list[i];
            }
          }

          rt.pipeIter = undefined;

          writeResult(rt, slot, undefined);

          return undefined;
        }

        // -----------------------------------
        // SOME
        // -----------------------------------

        case "some": {
          for (let i = 0; i < list.length; i++) {
            const out = await runIteration(rt, list[i], i);

            if (out) {
              rt.pipeIter = undefined;

              writeResult(rt, slot, true);

              return true;
            }
          }

          rt.pipeIter = undefined;

          writeResult(rt, slot, false);

          return false;
        }

        // -----------------------------------
        // EVERY
        // -----------------------------------

        case "every": {
          for (let i = 0; i < list.length; i++) {
            const out = await runIteration(rt, list[i], i);

            if (!out) {
              rt.pipeIter = undefined;

              writeResult(rt, slot, false);

              return false;
            }
          }

          rt.pipeIter = undefined;

          writeResult(rt, slot, true);

          return true;
        }

        // -----------------------------------
        // COUNT
        // -----------------------------------

        case "count": {
          let count = 0;

          for (let i = 0; i < list.length; i++) {
            const out = await runIteration(rt, list[i], i);

            if (out) {
              count++;
            }
          }

          rt.pipeIter = undefined;

          writeResult(rt, slot, count);

          return count;
        }

        default:
          throw new Error(`Unknown pipe mode ${mode}`);
      }
    },
  };
}

function collectAllSteps(workflow: WorkflowDef<any, any, any, any>) {
  const all: StepDef<any>[] = [];

  function visit(step: StepDef<any>) {
    all.push(step);

    if (step.spec === "__pipe__" && step.pipe) {
      for (const s of step.pipe.steps ?? []) {
        visit(s);
      }
    }
  }

  for (const step of workflow.steps) {
    visit(step);
  }

  return all;
}

export function compileWorkflow(
  workflow: WorkflowDef<any, any, any, any>,
  ctx: CompilerCtx,
): ExecutionPlan {
  const flatSteps = collectAllSteps(workflow);

  const slotMap = assignSlots(flatSteps);

  // const compiledLevels = buildLevels(workflow.steps).map((level) =>
  const compiledLevels = buildLevels(workflow.steps).map((level) =>
    level.map((step) => {
      const slot = slotMap.get(step.idx)!;

      if (step.spec === "__pipe__") {
        return compilePipeStep(step, ctx, slot, slotMap);
      }

      return compileStep(step, ctx, slot, slotMap);
    }),
  );

  return {
    levels: compiledLevels,

    outputSlot:
      workflow.outputIdx !== undefined
        ? slotMap.get(workflow.outputIdx)
        : undefined,

    exitSlots: workflow.endSteps?.map((s) => slotMap.get(s.idx)!),

    maxSlot: slotMap.size,

    slotMap,
  };
}

export function compileModule(mod: any, services: any, meta?: any): any {
  const deps = mod[DEPS] ?? {};

  const compiledDeps = Object.fromEntries(
    Object.entries(deps).map(([name, child]: any) => [
      name,
      compileModule(child, services, meta),
    ]),
  );

  const compiledGraph = Object.fromEntries(
    Object.entries(mod[EXEC_GRAPH]).map(([wfId, wf]: any) => [
      wfId,
      compileWorkflow(wf, { services, meta }),
    ]),
  );

  return {
    ...mod,

    [DEPS]: compiledDeps,

    [COMPILED_GRAPH]: compiledGraph,
  };
}

export function buildLevels(steps: StepDef<any>[]): StepDef<any>[][] {
  const remainingDeps = new Map<number, number>();
  const dependents = new Map<number, number[]>();
  const ready: number[] = [];

  const stepByIdx = new Map(steps.map((s) => [s.idx, s]));

  for (const step of steps) {
    remainingDeps.set(step.idx, step.dependsOn.length);

    if (step.dependsOn.length === 0) {
      ready.push(step.idx);
    }

    for (const dep of step.dependsOn) {
      if (!dependents.has(dep)) {
        dependents.set(dep, []);
      }

      dependents.get(dep)!.push(step.idx);
    }
  }

  const levels: StepDef<any>[][] = [];

  while (ready.length > 0) {
    const batch = ready.splice(0);

    levels.push(batch.map((idx) => stepByIdx.get(idx)!));

    for (const idx of batch) {
      for (const child of dependents.get(idx) ?? []) {
        const left = remainingDeps.get(child)! - 1;

        remainingDeps.set(child, left);

        if (left === 0) {
          ready.push(child);
        }
      }
    }
  }

  return levels;
}

import { ArgNode, ConditionNode } from "./ast.js";
import { composeObserver } from "./observer.js";
import { COMPILED_GRAPH, DEPS, EXEC_GRAPH } from "./symbols.js";
import { ExecutionFrame, WorkflowObserver } from "./types.js";
import { StepDef, WorkflowDef } from "./workflow-composer.js";

export type ExecutionPlan = {
  levels: CompiledStep[][];
  outputIndex?: number;
  exitIndexes?: number[];
  maxIdx: number;
};

type CompiledArg = (input: any, results: any[]) => any;

type CompiledCondition = (input: any, results: any[]) => boolean;

type CompiledStep = {
  idx: number;
  deps: number[];
  guards: number[];

  run: (ctx: {
    input: any;
    results: any[];
    observers: WorkflowObserver[];
    extras: Record<string, any>;
    runWithObservers: (ctx: any, core: () => Promise<any>) => Promise<any>;
  }) => Promise<any>;
};

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
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(step.idx);
    }
  }

  const levels: StepDef<any>[][] = [];

  while (ready.length > 0) {
    const batch = ready.splice(0);
    const batchSteps = batch.map((i) => stepByIdx.get(i)!);

    levels.push(batchSteps);

    for (const id of batch) {
      for (const child of dependents.get(id) ?? []) {
        const left = remainingDeps.get(child)! - 1;
        remainingDeps.set(child, left);
        if (left === 0) ready.push(child);
      }
    }
  }

  return levels;
}

async function runWithRetry(
  actionFn: () => Promise<any>,
  stepOptions?: {
    retry?: number;
    retryDelay?: number | ((attempt: number) => number);
  },
): Promise<any> {
  const maxRetries = stepOptions?.retry ?? 0;
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await actionFn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;

      const delay = stepOptions?.retryDelay;
      if (typeof delay === "number")
        await new Promise((r) => setTimeout(r, delay));
      else if (typeof delay === "function")
        await new Promise((r) => setTimeout(r, delay(attempt)));
    }
  }

  throw lastError;
}

async function withTimeout<T>(promise: Promise<T>, ms?: number): Promise<T> {
  if (!ms) return promise;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms),
    ),
  ]);
}

function compileCondition(cond: ConditionNode): (...args: any[]) => boolean {
  switch (cond.type) {
    case "eq": {
      const left = compileArgNode(cond.left);
      const right = compileArgNode(cond.right);
      return (input: any, results: any[]) =>
        left(input, results) === right(input, results);
    }

    case "neq": {
      const left = compileArgNode(cond.left);
      const right = compileArgNode(cond.right);
      return (input: any, results: any[]) =>
        left(input, results) !== right(input, results);
    }

    case "gt": {
      const left = compileArgNode(cond.left);
      const right = compileArgNode(cond.right);
      return (input, results) => left(input, results) > right(input, results);
    }

    case "gte": {
      const left = compileArgNode(cond.left);
      const right = compileArgNode(cond.right);
      return (input, results) => left(input, results) >= right(input, results);
    }

    case "lt": {
      const left = compileArgNode(cond.left);
      const right = compileArgNode(cond.right);
      return (input, results) => left(input, results) < right(input, results);
    }

    case "lte": {
      const left = compileArgNode(cond.left);
      const right = compileArgNode(cond.right);
      return (input, results) => left(input, results) <= right(input, results);
    }

    case "and": {
      const compiled = cond.conditions.map((c) => compileCondition(c));
      return (input, results) => {
        for (let i = 0; i < compiled.length; i++) {
          if (!compiled[i](input, results)) return false;
        }
        return true;
      };
    }

    case "or": {
      const compiled = cond.conditions.map((c: any) => compileCondition(c));
      return (input, results) => {
        for (let i = 0; i < compiled.length; i++) {
          if (compiled[i](input, results)) return true;
        }
        return false;
      };
    }

    case "not": {
      const inner = compileCondition(cond.condition);
      return (input, results) => !inner(input, results);
    }

    case "truthy": {
      const val = compileArgNode(cond.value);
      return (input, results) => !!val(input, results);
    }

    case "falsy": {
      const val = compileArgNode(cond.value);
      return (input, results) => !val(input, results);
    }

    default:
      throw new Error(`Unknown condition type: ${(cond as any).type}`);
  }
}

function compileArgNode(node: ArgNode): CompiledArg {
  switch (node.type) {
    case "const": {
      const value = node.value;

      if (typeof value === "object" && value !== null) {
        const compiled = deepCompileValue(value);
        return (input, results) => compiled(input, results);
      }

      return () => value;
    }

    case "get": {
      const ref = node.ref;
      const path = node.path;

      return (_, results: ResultsArray) => {
        let v = Object.prototype.hasOwnProperty.call(results, ref)
          ? results[ref]
          : results.__parent?.[ref];
        for (let i = 0; i < path.length; i++) {
          v = v?.[path[i]];
        }
        return v;
      };
    }
  }
}

function isArgNode(v: any): v is ArgNode {
  if (!v || typeof v !== "object") return false;

  switch (v.type) {
    case "const":
      return "value" in v;

    case "get":
      return "ref" in v && "path" in v;

    default:
      return false;
  }
}

function readResult(results: any[], ref: number) {
  let cur = results;

  while (cur) {
    if (Object.prototype.hasOwnProperty.call(cur, ref)) {
      return cur[ref];
    }
    cur = (cur as any).__parent;
  }

  return undefined;
}

function resolveResult(results: any[], ref: number) {
  if (Object.prototype.hasOwnProperty.call(results, ref)) {
    return results[ref];
  }
  return (results as any).__parent?.[ref];
}

function checkGuards(guards: number[] | undefined, results: any[]) {
  if (!guards || guards.length === 0) return true;

  for (let i = 0; i < guards.length; i++) {
    if (resolveResult(results, guards[i]) !== true) {
      return false;
    }
  }

  return true;
}

// function checkGuards(guards: number[] | undefined, results: any[]) {
//   if (!guards || guards.length === 0) return true;
//
//   for (let i = 0; i < guards.length; i++) {
//     if (!results[guards[i]]) return false;
//   }
//
//   return true;
// }

// function checkGuards(guards: Guard[], results: any[]) {
//   if (!guards || guards.length === 0) return true;
//
//   for (const g of guards) {
//     if (typeof g === "number") {
//       if (!results[g]) return false;
//     } else {
//       if (results[g.not] === true) return false;
//     }
//   }
//   return true;
// }

function deepCompileValue(value: any) {
  if (value == null) return () => value;

  if (Array.isArray(value)) {
    const compiled = value.map((v) => deepCompileValue(v));

    return (input: any, results: any[]) => {
      const out = new Array(compiled.length);
      for (let i = 0; i < compiled.length; i++) {
        out[i] = compiled[i](input, results);
      }
      return out;
    };
  }

  if (typeof value === "object") {
    if (isArgNode(value)) {
      return compileArgNode(value as ArgNode);
    }

    const keys = Object.keys(value);
    const compiledEntries = keys.map((k) => [k, deepCompileValue(value[k])]);

    return (input: any, results: any[]) => {
      const out: any = {};
      for (let i = 0; i < compiledEntries.length; i++) {
        const [k, fn] = compiledEntries[i];
        out[k as any] = (fn as any)(input, results);
      }
      return out;
    };
  }

  return () => value;
}

async function runAction(args: any[] | undefined, action: any) {
  if (!args) return action();
  return action(...args);
}

export async function executePlan(
  plan: ExecutionPlan,
  input: any,
  observers: WorkflowObserver[],
  results: any[],
) {
  const extras: Record<string, any> = { frames: {} };

  const runWithObservers = composeObserver(observers);

  for (const level of plan.levels) {
    await Promise.all(
      level.map((step) => {
        if (!checkGuards(step.guards, results)) {
          results[step.idx] = undefined;
          return;
        }

        return step.run({
          input,
          results,
          observers,
          extras,
          runWithObservers,
        });
      }),
    );
  }

  if (plan.outputIndex !== undefined) {
    return results[plan.outputIndex];
  }

  if (plan.exitIndexes?.length) {
    return plan.exitIndexes.length === 1
      ? results[plan.exitIndexes[0]]
      : plan.exitIndexes.map((i) => results[i]);
  }

  return undefined;
}

type ResultsArray = any[] & {
  __parent?: ResultsArray;
};

type RuntimeCtx = {
  step: any;
  input: any;
  results: any[];
  compiledResolve: CompiledArg[] | null;
  compiledEval?: CompiledCondition | null;
  observers: WorkflowObserver[];
  frame?: ExecutionFrame;
};

function createPipeResults(parent: ResultsArray, size: number): ResultsArray {
  const local = new Array(size) as ResultsArray;
  local.__parent = parent;
  return local;
}

async function runStepCore({
  step,
  input,
  results,
  observers,
  compiledEval,
  compiledResolve,
  frame,
}: RuntimeCtx) {
  return async () => {
    try {
      if (frame) frame.attempts++;

      if (step.method === "__eval__") {
        const res = compiledEval!(input, results);

        if (frame) {
          frame.output = res;
          frame.end = Date.now();
        }

        return res;
      }

      if (step.method === "__join__") {
        if (frame) {
          frame.end = Date.now();
        }

        return;
      }

      let resolvedArgs: any[] | undefined;

      if (compiledResolve) {
        const len = compiledResolve.length;
        resolvedArgs = new Array(len);

        for (let i = 0; i < len; i++) {
          resolvedArgs[i] = compiledResolve[i](input, results);
        }
      }

      if (frame) {
        frame.input = resolvedArgs;
      }

      if (step.method === "__pipe__") {
        const items = resolvedArgs?.[0] ?? [];
        const mode = step.pipe.mode ?? "map";

        const runPipeIteration = (item: any) => {
          const localResults = createPipeResults(
            results,
            step.pipe.plan.maxIdx + 1,
          );

          return executePlan(step.pipe.plan, item, observers, localResults);
        };

        if (
          mode === "find" ||
          mode === "some" ||
          mode === "every" ||
          mode === "count"
        ) {
          let count = 0;
          for (let i = 0; i < items.length; i++) {
            const res = await runPipeIteration(items[i]);

            if (mode === "find" && res) {
              return items[i];
            }

            if (mode === "some" && res) {
              return true;
            }

            if (mode === "every" && !res) {
              return false;
            }

            if (mode === "count" && res) {
              count++;
            }
          }

          if (mode === "find") {
            return undefined;
          }

          if (mode === "some") {
            return false;
          }

          if (mode === "every") {
            return true;
          }

          if (mode === "count") {
            return count;
          }
        }

        const outputs = await Promise.all(items.map(runPipeIteration));
        if (mode === "map") {
          return outputs;
        }

        if (mode === "filter") {
          const filtered = (items as any[]).filter((_, i) => !!outputs[i]);

          return filtered;
        }

        throw new Error(`Unknown pipe mode: ${mode}`);
      }

      if (step.method === "__init__") {
        if (step.resolve.length === 0) {
          return input;
        } else {
          return resolvedArgs?.[0];
        }
      }

      if (step.method === "__action__") {
        const action = step.action;

        const result = await withTimeout(
          runWithRetry(() => runAction(resolvedArgs, action), step.options),
          step.options?.timeout,
        );

        if (frame) {
          frame.output = result;
          frame.end = Date.now();
        }

        return result;
      }

      if (step.method === "__output__") {
        const val = resolvedArgs?.[0];

        if (frame) {
          frame.output = val;
          frame.end = Date.now();
        }

        return val;
      }

      throw new Error(`Unknown step type: ${step.idx}`);
    } catch (err) {
      if (frame) {
        frame.error = err;
        frame.end = Date.now();
      }
      throw err;
    }
  };
}

export function compileStep(step: StepDef<any>): CompiledStep {
  let compiledEval: ((input: any, results: any[]) => boolean) | null = null;

  if (step.method === "__eval__") {
    compiledEval = compileCondition(step.eval!);
  }

  const compiledResolve =
    step.method === "__eval__"
      ? null
      : (step.resolve?.map((n: ArgNode) => compileArgNode(n)) ?? null);

  return {
    idx: step.idx,
    deps: step.dependsOn,
    guards: step.guards ?? [],

    run: async ({ input, results, observers, extras, runWithObservers }) => {
      const params: RuntimeCtx = {
        input,
        step,
        results,
        observers,
        compiledEval,
        compiledResolve,
      };

      let res: any;

      if (observers.length) {
        const frame: ExecutionFrame = {
          stepId: `${step.id}:${step.idx}`,
          attempts: 0,
          start: Date.now(),
        };

        params.frame = frame;

        extras.frames[step.idx] = params.frame;

        const fn = await runStepCore(params);

        res = await runWithObservers(
          { stepId: `${step.id}:${step.idx}`, input, results, extras, frame },
          fn,
        );
      } else {
        const fn = await runStepCore(params);

        res = await fn();
      }
      results[step.idx] = res;

      return res;
    },
  };
}

export function compileModule(mod: any, services: any): any {
  const deps = mod[DEPS] ?? {};

  const compiledDeps = Object.fromEntries(
    Object.entries(deps).map(([name, child]: any) => [
      name,
      compileModule(child, services),
    ]),
  );

  const compiledGraph = Object.fromEntries(
    Object.entries(mod[EXEC_GRAPH]).map(([wfId, wf]: any) => [
      wfId,
      compileWorkflow(wf, services, compiledDeps),
    ]),
  );

  return {
    ...mod,
    [DEPS]: compiledDeps,
    [COMPILED_GRAPH]: compiledGraph,
  };
}

export function compileWorkflow(
  workflow: WorkflowDef<any, any, any, any>,
  services: any,
  deps: Record<string, any>,
): ExecutionPlan {
  let outputIndex: number | undefined;
  let exitIndexes: number[] | undefined;

  if (workflow.outputIdx !== undefined) {
    outputIndex = workflow.outputIdx;
  } else if (workflow.endSteps?.length) {
    exitIndexes = workflow.endSteps.map((s) => s.idx);
  }

  const compiledSteps = workflow.steps.map((step: any) => {
    if (step.service) {
      const s = services?.[step.service!];
      if (!s) {
        throw new Error(`Service not found: ${step.service}`);
      }

      const action = s[step.method];
      if (!action) {
        throw new Error(`Method ${step.method} not found on ${step.service}`);
      }

      return {
        ...step,
        method: "__action__",
        action,
      };
    }

    if (step.method === "__pipe__") {
      return {
        ...step,
        pipe: {
          ...step.pipe,
          plan: compileWorkflow(step.pipe.workflow, services, deps),
        },
      };
    }

    return step;
  });

  const levels = buildLevels(compiledSteps);
  const compiledLevels = levels.map((level) =>
    level.map((step) => compileStep(step)),
  );

  const maxIdx = Math.max(...workflow.steps.map((s: any) => s.idx));

  return {
    levels: compiledLevels,
    maxIdx,
    outputIndex,
    exitIndexes,
  };
}

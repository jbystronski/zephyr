import { ExprNode } from "./ast.js";
import { composeObserver } from "./observer.js";
import { COMPILED_GRAPH, DEPS, EXEC_GRAPH } from "./symbols.js";
import { ExecutionFrame, WorkflowObserver } from "./types.js";
import { StepDef, WorkflowDef } from "./workflow-composer.js";

type ResultsArray = any[] & {
  __parent?: ResultsArray;
};

type EvalCtx = {
  input: any;
  results: ResultsArray;
  services: any;
};

type CompiledStep = {
  idx: number;
  id: string;
  deps: number[];
  guards: number[];

  run: (ctx: {
    input: any;
    results: ResultsArray;
    services: any;
    observers: WorkflowObserver[];
    frame?: ExecutionFrame;
  }) => Promise<any>;
};

export type ExecutionPlan = {
  levels: CompiledStep[][];
  outputIndex?: number;
  exitIndexes?: number[];
  maxIdx: number;
};

function readResult(results: ResultsArray, ref: number) {
  let cur: ResultsArray | undefined = results;

  while (cur) {
    if (Object.prototype.hasOwnProperty.call(cur, ref)) {
      return cur[ref];
    }

    cur = cur.__parent;
  }

  return undefined;
}

function resolveResult(results: ResultsArray, ref: number) {
  if (Object.prototype.hasOwnProperty.call(results, ref)) {
    return results[ref];
  }

  return results.__parent?.[ref];
}

function checkGuards(guards: number[] | undefined, results: ResultsArray) {
  if (!guards?.length) {
    return true;
  }

  for (const ref of guards) {
    if (resolveResult(results, ref) !== true) {
      return false;
    }
  }

  return true;
}

function createPipeResults(parent: ResultsArray, size: number): ResultsArray {
  const local = new Array(size) as ResultsArray;
  local.__parent = parent;
  return local;
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

async function withTimeout<T>(promise: Promise<T>, ms?: number): Promise<T> {
  if (!ms) {
    return promise;
  }

  return Promise.race([
    promise,

    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms),
    ),
  ]);
}

async function runWithRetry<T>(
  fn: () => Promise<T>,
  options?: {
    retry?: number;
    retryDelay?: number | ((attempt: number) => number);
  },
): Promise<T> {
  const maxRetries = options?.retry ?? 0;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries) {
        break;
      }

      const delay = options?.retryDelay;

      if (typeof delay === "number") {
        await new Promise((r) => setTimeout(r, delay));
      } else if (typeof delay === "function") {
        await new Promise((r) => setTimeout(r, delay(attempt)));
      }
    }
  }

  throw lastError;
}

async function evalConst(value: any, ctx: EvalCtx): Promise<any> {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    const out = [];

    for (const item of value) {
      out.push(await evalConst(item, ctx));
    }

    return out;
  }

  if (typeof value === "object") {
    if (isExprNode(value)) {
      return evalExpr(value as ExprNode, ctx);
    }

    const out: any = {};

    for (const key in value) {
      out[key] = await evalConst(value[key], ctx);
    }

    return out;
  }

  return value;
}

function isExprNode(v: any): v is ExprNode {
  if (!v || typeof v !== "object") {
    return false;
  }

  switch (v.type) {
    case "const":
      return "value" in v;

    case "get":
      return "ref" in v && "path" in v;

    case "call":
      return "service" in v && "method" in v && Array.isArray(v.args);

    default:
      return false;
  }
}
async function evalExpr(node: ExprNode, ctx: EvalCtx): Promise<any> {
  switch (node.type) {
    case "const": {
      return evalConst(node.value, ctx);
    }

    case "get": {
      let value = readResult(ctx.results, node.ref);

      for (const part of node.path) {
        value = value?.[part];
      }

      return value;
    }

    case "call": {
      const service = ctx.services[node.service];

      if (!service) {
        throw new Error(`Unknown service ${node.service}`);
      }

      const method = service[node.method];

      if (!method) {
        throw new Error(`Unknown method ${node.service}.${node.method}`);
      }

      const args = [];

      for (const arg of node.args) {
        args.push(await evalExpr(arg, ctx));
      }

      return method(...args);
    }
  }
}

// async function executeStep(
//   step: StepDef<any>,
//   ctx: EvalCtx,
//   observers: WorkflowObserver[],
// ): Promise<any> {
//   switch (step.spec) {
//     case "__init__": {
//       if (!step.resolve) {
//         return ctx.input;
//       }
//
//       return evalExpr(step.resolve as ExprNode, ctx);
//     }
//
//     case "__out__": {
//       if (!step.resolve) {
//         return undefined;
//       }
//
//       return evalExpr(step.resolve as ExprNode, ctx);
//     }
//
//     case "__join__": {
//       return undefined;
//     }
//
//     case "__pipe__": {
//       return runPipeStep(step, ctx, observers);
//     }
//
//     default: {
//       if (!step.resolve) {
//         return undefined;
//       }
//
//       return evalExpr(step.resolve as ExprNode, ctx);
//     }
//   }
// }
//
async function executeStep(
  step: StepDef<any>,
  ctx: EvalCtx,
  observers: WorkflowObserver[],
  frame?: ExecutionFrame,
): Promise<any> {
  try {
    if (frame) {
      frame.attempts++;
    }

    let result: any;

    switch (step.spec) {
      case "__init__": {
        result = step.resolve
          ? await evalExpr(step.resolve as ExprNode, ctx)
          : ctx.input;

        break;
      }

      case "__out__": {
        result = step.resolve
          ? await evalExpr(step.resolve as ExprNode, ctx)
          : undefined;

        break;
      }

      case "__join__": {
        result = undefined;
        break;
      }

      case "__pipe__": {
        result = await runPipeStep(step, ctx, observers);
        break;
      }

      default: {
        result = step.resolve
          ? await evalExpr(step.resolve as ExprNode, ctx)
          : undefined;

        break;
      }
    }

    if (frame) {
      frame.output = result;
      frame.end = Date.now();
    }

    return result;
  } catch (err) {
    if (frame) {
      frame.error = err;
      frame.end = Date.now();
    }

    throw err;
  }
}

async function runPipeStep(
  step: StepDef<any>,
  ctx: EvalCtx,
  observers: WorkflowObserver[],
): Promise<any> {
  const items = await evalExpr(step.resolve as ExprNode, ctx);

  const mode = step.pipe?.mode ?? "map";

  const runItem = async (item: any) => {
    const localResults = createPipeResults(
      ctx.results,
      (step.pipe as any).plan.maxIdx + 1,
    );

    return executePlan(
      (step.pipe as any).plan,
      item,
      ctx.services,
      observers,
      localResults,
    );
  };

  if (mode === "map") {
    return Promise.all(items.map(runItem));
  }

  if (mode === "filter") {
    const matches = await Promise.all(items.map(runItem));

    return items.filter((_: any, i: number) => !!matches[i]);
  }

  if (mode === "find") {
    for (const item of items) {
      if (await runItem(item)) {
        return item;
      }
    }

    return undefined;
  }

  if (mode === "some") {
    for (const item of items) {
      if (await runItem(item)) {
        return true;
      }
    }

    return false;
  }

  if (mode === "every") {
    for (const item of items) {
      if (!(await runItem(item))) {
        return false;
      }
    }

    return true;
  }

  if (mode === "count") {
    let count = 0;

    for (const item of items) {
      if (await runItem(item)) {
        count++;
      }
    }

    return count;
  }

  throw new Error(`Unknown pipe mode ${mode}`);
}

export async function executePlan(
  plan: ExecutionPlan,
  input: any,
  services: any,
  observers: WorkflowObserver[],
  results: ResultsArray,
) {
  const hasObservers = observers.length > 0;

  const extras: Record<string, any> = {
    frames: {},
  };

  const runWithObservers = hasObservers ? composeObserver(observers) : null;

  for (const level of plan.levels) {
    await Promise.all(
      level.map(async (step) => {
        if (!checkGuards(step.guards, results)) {
          results[step.idx] = undefined;
          return;
        }

        const frame: ExecutionFrame | undefined = hasObservers
          ? {
              stepId: `${step.id}:${step.idx}`,
              attempts: 1,
              start: Date.now(),
            }
          : undefined;

        if (frame) {
          extras.frames[step.idx] = frame;
        }

        const execute = async () => {
          return step.run({
            input,
            results,
            services,
            observers,
            frame,
          });
        };

        try {
          const result = runWithObservers
            ? await runWithObservers(
                {
                  stepId: `${step.idx}`,
                  input,
                  results,
                  extras,
                  frame,
                },
                execute,
              )
            : await execute();

          results[step.idx] = result;

          if (frame) {
            frame.output = result;
            frame.end = Date.now();
          }
        } catch (err) {
          if (frame) {
            frame.error = err;
            frame.end = Date.now();
          }

          throw err;
        }
      }),
    );
  }

  if (plan.outputIndex !== undefined) {
    return results[plan.outputIndex];
  }

  if (plan.exitIndexes?.length) {
    if (plan.exitIndexes.length === 1) {
      return results[plan.exitIndexes[0]];
    }

    return plan.exitIndexes.map((idx) => results[idx]);
  }

  return undefined;
}

export function compileStep(step: StepDef<any>): CompiledStep {
  return {
    id: step.id,
    idx: step.idx,
    deps: step.dependsOn,
    guards: step.guards ?? [],

    run: async ({ input, results, services, observers, frame }) => {
      const ctx: EvalCtx = {
        input,
        results,
        services,
      };

      if (step.pipe) {
        return runPipeStep(step, ctx, observers);
      }

      return executeStep(step, ctx, observers, frame);
    },
  };
}

export function compileWorkflow(
  workflow: WorkflowDef<any, any, any, any>,
): ExecutionPlan {
  let outputIndex: number | undefined;

  let exitIndexes: number[] | undefined;

  if (workflow.outputIdx !== undefined) {
    outputIndex = workflow.outputIdx;
  } else if (workflow.endSteps?.length) {
    exitIndexes = workflow.endSteps.map((s) => s.idx);
  }

  const compiledSteps = workflow.steps.map((step: any) => {
    if (step.pipe?.workflow) {
      return {
        ...step,

        pipe: {
          ...step.pipe,

          plan: compileWorkflow(step.pipe.workflow),
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
    outputIndex,
    exitIndexes,
    maxIdx,
  };
}

export function compileModule(mod: any): any {
  const deps = mod[DEPS] ?? {};

  const compiledDeps = Object.fromEntries(
    Object.entries(deps).map(([name, child]: any) => [
      name,
      compileModule(child),
    ]),
  );

  const compiledGraph = Object.fromEntries(
    Object.entries(mod[EXEC_GRAPH]).map(([wfId, wf]: any) => [
      wfId,
      compileWorkflow(wf),
    ]),
  );

  return {
    ...mod,

    [DEPS]: compiledDeps,

    [COMPILED_GRAPH]: compiledGraph,
  };
}

import { composeObserver } from "./observer.js";
import { UNSET } from "./symbols.js";
import {
  CompiledStep,
  ExecutionFrame,
  ExecutionPlan,
  PipeMode,
  StepRuntimeCtx,
  WorkflowObserver,
} from "./types.js";

export function createExecutor(
  plan: ExecutionPlan,
  services: Record<string, any>,
  observers: WorkflowObserver[],
) {
  if (observers.length === 0) return createFastExecutor(plan, services);
  return createObservedExecutor(plan, services, observers);
}

// TODO: add await to normalize Promise maybe value
//
// const value = await executeStep(step, rt);
// results[step.idx] = await Promise.resolve(value);
//
// AND in observed
//
// const value = await executeStep(step, rt);
// frame.value = await Promise.resolve(value);
// results[step.idx] = value;

function createFastExecutor(
  plan: ExecutionPlan,
  services: Record<string, any>,
) {
  return async function executePlanFast(results: any[]) {
    const rt = {
      services,
      results,
      observers: [],
    };

    for (const level of plan.levels) {
      await Promise.all(
        level.map(async (step) => {
          if (!checkGuards(step.guards, rt)) {
            results[step.idx] = undefined;
            return;
          }

          if (results[step.idx] === undefined) {
            results[step.idx] = await executeStepWithOptions(step, rt);
          }
        }),
      );
    }

    return results[plan.outputIndex!];
  };
}

async function executeStepWithOptions(step: CompiledStep, rt: StepRuntimeCtx) {
  const opts = step.options;

  const execute = async () => {
    let execution = executeStep(step, rt);

    if (opts?.timeout) {
      execution = withTimeout(execution, opts.timeout);
    }

    return await execution;
  };

  try {
    if (opts?.retry) {
      return await runWithRetry(execute, {
        retry: opts.retry.count,
        retryDelay: opts.retry?.delay ?? 0,
      });
    }

    return await execute();
  } catch (err) {
    if (opts?.fallback !== undefined) {
      return opts.fallback;
    }

    if (opts?.swallow === true) {
      return undefined;
    }

    throw err;
  }
}

function createObservedExecutor(
  plan: ExecutionPlan,
  services: Record<string, any>,
  observers: WorkflowObserver[],
) {
  const observerFn = composeObserver(observers);

  return async function executePlanObserved(
    results: any[],
    extras: Record<string, unknown>,
  ) {
    const rootRt = {
      services,
      results,
      observers,
      frame: undefined,
    };

    for (const level of plan.levels) {
      await Promise.all(
        level.map(async (step) => {
          const frame: ExecutionFrame = {
            stepId: `${step.id}:${step.idx}`,
            attempts: 0,
            start: Date.now(),
          };

          const rt = {
            ...rootRt,

            frame,
          };

          if (!checkGuards(step.guards, rt)) {
            results[step.idx] = undefined;
            return;
          }

          const run = async () => {
            frame.attempts++;

            if (results[step.idx] === undefined) {
              const value = await executeStepWithOptions(step, rt);
              results[step.idx] = value;
            }

            frame.value = results[step.idx];
            frame.end = Date.now();

            return results[step.idx];
          };

          try {
            await observerFn(
              {
                stepId: `${step.idx}`,

                results,
                extras,
                frame,
              },
              run,
            );
          } catch (err) {
            frame.error = err;
            frame.end = Date.now();
            throw err;
          }
        }),
      );
    }

    return results[plan.outputIndex!];
  };
}

async function executeStep(step: CompiledStep, rt: StepRuntimeCtx) {
  if (step?.spec === "__sub__") {
    const input = step.resolve ? await step.resolve(rt) : null;
    const exec = createExecutor(step.plan!, rt.services, rt.observers);

    const results = new Array(step.plan!.maxIndex + 1);

    if (typeof step.plan?.initIdx === "number") {
      results[step.plan.initIdx] = input;
    }

    return exec(results, {});
  }

  if (step?.spec === "__pipe__") {
    const { items, ...rest } = step.resolve ? await step.resolve(rt) : null;
    const list = Array.isArray(items) ? items : [];

    const plan = step?.plan!;
    const initIdx = plan.initIdx;
    const maxIndex = plan.maxIndex;

    const exec = createExecutor(plan!, rt.services, rt.observers);

    let mode: PipeMode = step?.pipeMode ?? "map";

    const iterate = (item: any) => {
      const results = new Array(maxIndex + 1);

      if (typeof initIdx === "number") {
        results[initIdx] = { item, ...rest };
      }

      return exec(results, {});
    };

    switch (mode) {
      case "map":
        return Promise.all(
          list.map(async (item) => {
            return iterate(item);
          }),
        );

      case "filter": {
        const res = [];

        for (let i = 0; i < list.length; i++) {
          const out = await iterate(list[i]);

          if (out) {
            res.push(list[i]);
          }
        }

        return res;
      }
      case "find": {
        for (let i = 0; i < list.length; i++) {
          const out = await iterate(list[i]);

          if (out) {
            return list[i];
          }
        }

        return undefined;
      }

      case "some": {
        for (let i = 0; i < list.length; i++) {
          const out = await iterate(list[i]);

          if (out) {
            return true;
          }
        }

        return false;
      }

      case "every": {
        for (let i = 0; i < list.length; i++) {
          const out = await iterate(list[i]);

          if (!out) {
            return false;
          }
        }

        return true;
      }

      case "count": {
        let count = 0;

        for (let i = 0; i < list.length; i++) {
          const out = await iterate(list[i]);

          if (out) count++;
        }

        return count;
      }
    }
  }

  return step.resolve ? await step.resolve(rt) : undefined;
}

function checkGuards(guards: number[] | undefined, rt: StepRuntimeCtx) {
  if (!guards?.length) {
    return true;
  }

  for (const ref of guards) {
    const res = rt.results[ref];

    if (res === undefined) {
      throw new Error(`Unknown guard ref: ${ref}`);
    }

    if (res !== true) {
      return false;
    }
  }

  return true;
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

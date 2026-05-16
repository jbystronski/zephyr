import {
  CompiledStep,
  readResult,
  ResultsArray,
  StepRuntimeCtx,
  writeResult,
} from "./ast-compiler.js";
import { composeObserver } from "./observer.js";
import { ExecutionFrame, WorkflowObserver } from "./types.js";

export type ExecutionPlan = {
  levels: CompiledStep[][];
  outputSlot?: number;
  exitSlots?: number[];

  maxSlot: number;

  slotMap: Map<number, number>;
};

function checkGuards(
  guards: number[] | undefined,
  rt: StepRuntimeCtx,
  slotMap: Map<number, number>,
) {
  if (!guards?.length) {
    return true;
  }

  for (const ref of guards) {
    const slot = slotMap.get(ref);

    if (slot === undefined) {
      throw new Error(`Unknown guard ref: ${ref}`);
    }

    if (readResult(rt, slot) !== true) {
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

export async function executePlan(
  plan: ExecutionPlan,
  input: any,
  observers: WorkflowObserver[],
) {
  const results: ResultsArray = new Array(plan.maxSlot);

  const hasObservers = observers.length > 0;

  const runWithObservers = hasObservers ? composeObserver(observers) : null;

  const extras: Record<string, any> = {
    frames: {},
  };

  // -----------------------------------
  // ROOT RUNTIME CONTEXT
  // -----------------------------------

  const rootRt: StepRuntimeCtx = {
    input,
    results,
    pipeIter: 0,
    observers,
    frame: undefined,
  };

  // -----------------------------------
  // EXECUTION
  // -----------------------------------

  for (const level of plan.levels) {
    await Promise.all(
      level.map(async (step) => {
        const frame: ExecutionFrame | undefined = hasObservers
          ? {
              stepId: `${step.id}:${step.idx}`,
              attempts: 0,
              start: Date.now(),
            }
          : undefined;

        // -----------------------------------
        // STEP RUNTIME
        // -----------------------------------

        const rt: StepRuntimeCtx = {
          ...rootRt,
          frame,
        };

        // -----------------------------------
        // GUARDS
        // -----------------------------------

        if (!checkGuards(step.guards, rt, plan.slotMap)) {
          writeResult(rt, step.slot, undefined);

          return;
        }

        if (frame) {
          extras.frames[step.idx] = frame;
        }

        // -----------------------------------
        // EXECUTION
        // -----------------------------------

        const execute = async () => {
          if (frame) {
            frame.attempts++;
          }

          const value = await step.run(rt);

          if (frame) {
            frame.value = value;
            frame.end = Date.now();
          }

          return value;
        };

        try {
          await (runWithObservers
            ? runWithObservers(
                {
                  stepId: `${step.idx}`,
                  input,
                  results,
                  extras,
                  frame,
                },
                execute,
              )
            : execute());
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

  // -----------------------------------
  // OUTPUT EXTRACTION
  // -----------------------------------

  let output: any;

  if (plan.outputSlot !== undefined) {
    output = readResult(rootRt, plan.outputSlot);
  } else if (plan.exitSlots?.length === 1) {
    output = readResult(rootRt, plan.exitSlots[0]);
  } else if (plan.exitSlots?.length) {
    output = plan.exitSlots.map((slot) => readResult(rootRt, slot));
  } else {
    output = undefined;
  }

  return output;
}

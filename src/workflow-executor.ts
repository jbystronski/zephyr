import { composeObserver } from "./observer.js";
import {
  ActionRegistry,
  ExecutionFrame,
  Executor,
  NormalizedCall,
  ServiceRegistry,
  WorkflowObserver,
} from "./types.js";
import { StepDef, WorkflowDef } from "./workflow-composer.js";

export function createCallHelpers() {
  return {
    args: (...args: any[]) => ({ kind: "positional", args }),
    obj: (arg: any) => ({ kind: "object", args: arg }),
    none: () => ({ kind: "none" }),
  };
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

// Helper to run action with retry support
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
      if (typeof delay === "number") {
        await new Promise((r) => setTimeout(r, delay));
      } else if (typeof delay === "function") {
        await new Promise((r) => setTimeout(r, delay(attempt)));
      }
    }
  }

  throw lastError;
}

export async function executeWorkflow<Reg extends ActionRegistry, I, R, O = R>({
  workflow,
  actionRegistry,
  services,
  input,

  depsExecutors,
  observers = [],
}: {
  workflow: WorkflowDef<Reg, I, any, any, O>;

  actionRegistry: Reg;
  services: ServiceRegistry;
  input: I;

  depsExecutors: Record<string, Executor>;
  observers: WorkflowObserver<Reg>[];
}): Promise<{
  // results: WorkflowResults<WR[K]>;
  output: O;
  extras: Record<string, any>;
}> {
  const results: Record<string, any> = {};
  const extras: Record<string, any> = {};
  extras.frames = {} as Record<string, ExecutionFrame>;

  // -----------------------------
  // Fully typed step map
  // -----------------------------
  // const stepById: Map<string, StepDef<Reg, any, any>> = new Map(
  //   workflow.steps.map((s: StepDef<Reg, any, any>) => [s.id, s]),
  // );
  const stepById = new Map(
    workflow.steps.map((s: StepDef<Reg, any, any>) => [s.id, s]),
  );

  const remainingDeps = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  const ready: string[] = [];

  for (const step of workflow.steps) {
    remainingDeps.set(step.id, step.dependsOn.length);
    if (step.dependsOn.length === 0) ready.push(step.id);

    for (const dep of step.dependsOn) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(step.id);
    }
  }

  let completed = 0;

  // -----------------------------
  // Normalized runner
  // -----------------------------
  const runAction = async (
    input: NormalizedCall | undefined,
    action: any,
  ): Promise<any> => {
    if (!input) return await action();

    switch (input.kind) {
      case "none":
        return await action();
      case "positional":
        return await action(...input.args);
      case "object":
        return await action(input.args);
      default:
        throw new Error(
          `Unknown ResolvedStepInput kind: ${(input as any).kind}`,
        );
    }
  };

  // -----------------------------
  // Execution loop
  // -----------------------------

  while (ready.length > 0) {
    const batch = ready.splice(0);

    await Promise.all(
      batch.map(async (stepId) => {
        const step = stepById.get(stepId)! as StepDef<Reg, any, any>;

        const frame: ExecutionFrame = {
          stepId,
          attempts: 0,
          start: Date.now(),
        };
        extras.frames[stepId] = frame;

        const ctx = {
          stepId,
          input,
          results,

          actionRegistry,
          extras,
          frame,
        };
        const stepCtx = {
          input,
          results,

          ...createCallHelpers(),
        };

        const resolvedArgs = step.resolve?.(stepCtx);

        frame.input = resolvedArgs;

        const core = async () => {
          frame.attempts++;

          // -----------------------------
          // ✅ SINGLE when evaluation
          // -----------------------------
          if (step.when && !step.when(stepCtx)) {
            frame.input = undefined; // 👈 important for observer consistency
            frame.output = undefined;
            frame.end = Date.now();
            frame.skipped = true;
            results[step.id] = undefined;
            return undefined;
          }

          // -----------------------------
          // Pipe handling
          // -----------------------------

          if (step.pipe && step.pipe.steps) {
            const items = step.pipe.input(stepCtx);

            const pipeResults = await Promise.all(
              items.map(async (item) => {
                let current = item;

                for (const pipeStep of step.pipe!.steps) {
                  const pipeCtx = {
                    current,
                    results,
                    ...createCallHelpers(),
                  };

                  const resolved = pipeStep.resolve(pipeCtx);
                  let action;

                  if (pipeStep.type === "action") {
                    action = actionRegistry[pipeStep.action!];
                  } else {
                    action = services[pipeStep.service!][pipeStep.method!];
                  }

                  if (!action) {
                    throw new Error(
                      `Unknown ${pipeStep.type} in pipe step: ${
                        pipeStep.type === "action"
                          ? pipeStep.action
                          : `${pipeStep.service}.${pipeStep.method}`
                      }`,
                    );
                  }

                  current = await runAction(resolved, action);
                }

                return current;
              }),
            );

            results[step.id] = pipeResults;
            frame.output = pipeResults;
            frame.end = Date.now();
            return pipeResults;
          }
          if (step.__subflowId) {
            // -----------------------------
            // Subflow handling
            // -----------------------------
            const [modId, subWfId] = step.__subflowId.split(".");

            const exec = depsExecutors[modId];

            const subExecution = await exec.run(
              subWfId,
              resolvedArgs,
              services,
              observers,
            );

            frame.output = subExecution.output;
            frame.end = Date.now();
            results[step.id] = subExecution.output;

            Object.assign(extras, subExecution.extras);

            return subExecution.output;
          }

          // -----------------------------
          // Normal action
          // -----------------------------
          const actionFn = async () => {
            let action = null;
            if (step.action === "__service__") {
              const { service, method } = step.serviceCall!;

              action = services[service][method];
            } else {
              action = actionRegistry[step.action];
            }

            console.log("action", action);
            return await runAction(resolvedArgs, action);
          };

          try {
            const result = await withTimeout(
              runWithRetry(actionFn, step.options),
              step.options?.timeout,
            );

            frame.output = result;
            frame.end = Date.now();
            results[step.id] = result;
            return result;
          } catch (err) {
            frame.error = err;
            frame.end = Date.now();

            if (step.options?.onError) {
              const fallback = step.options.onError(err, ctx);
              results[step.id] = fallback;
              return fallback;
            }

            if (step.options?.continueOnError) {
              results[step.id] = undefined;
              return undefined;
            }

            throw err;
          }
        };

        const composed = composeObserver(observers, ctx, core);
        await composed();

        for (const childId of dependents.get(stepId) ?? []) {
          const remaining = remainingDeps.get(childId)! - 1;
          remainingDeps.set(childId, remaining);
          if (remaining === 0) ready.push(childId);
        }

        completed++;
      }),
    );
  }

  if (completed !== workflow.steps.length) {
    throw new Error("Workflow execution failed (cycle or missing dependency)");
  }

  const output = workflow.outputResolver
    ? workflow.outputResolver({
        input,
        results,
      })
    : results;

  return {
    // results: results as WorkflowResults<WR[K]>,
    output: output as O,
    extras,
  };
}

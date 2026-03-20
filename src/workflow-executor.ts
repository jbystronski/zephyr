import { composeObserver } from "./observer.js";
import { ActionRegistry, ExecutionFrame, WorkflowObserver } from "./types.js";
import {
  StepDef,
  WorkflowDef,
  ResolvedStepInput,
} from "./workflow-composer.js";

function createCallHelpers() {
  return {
    args: (...args: any[]) => ({ kind: "positional", args }),
    obj: (arg: any) => ({ kind: "object", args: arg }),
    none: () => ({ kind: "none" }),
    loop: (items: any[]) => ({ kind: "loop", items }),
  };
}

export async function executeWorkflow<
  Reg extends ActionRegistry,
  I,
  R,
  O = R,
  Steps extends StepDef<Reg, any, any>[] = StepDef<Reg, any, any>[],
>(
  workflow: WorkflowDef<Reg, I, R, Steps, O>,
  registry: Reg,
  input: I,
  observers: WorkflowObserver<Reg>[] = [],
): Promise<{ results: R; output: O; extras: Record<string, any> }> {
  const results: Record<string, any> = {};
  const extras: Record<string, any> = {};
  extras.frames = {} as Record<string, ExecutionFrame>;

  // -----------------------------
  // Fully typed step map
  // -----------------------------
  const stepById: Map<string, StepDef<Reg, any, any>> = new Map(
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
    input: ResolvedStepInput | undefined,
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
      case "loop":
        return await Promise.all(
          input.items.map((item) => runAction(item, action)),
        );
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
        const step = stepById.get(stepId)!;

        const frame: ExecutionFrame = {
          stepId,
          attempts: 0,
          start: Date.now(),
        };
        extras.frames[stepId] = frame;

        const context = (workflow as any).__context;
        const ctx = {
          stepId,
          input,
          results,
          context,
          registry,
          extras,
          frame,
        };

        const core = async () => {
          frame.attempts++;
          const stepCtx = { input, results, context, ...createCallHelpers() };

          // Conditional skip
          if (step.when && !step.when(stepCtx)) {
            frame.output = undefined;
            frame.end = Date.now();
            frame.skipped = true;
            results[step.id] = undefined;
            return undefined;
          }

          const resolvedArgs = step.resolve?.(stepCtx);
          frame.input = resolvedArgs;

          try {
            const action = registry[step.action];
            const result = await runAction(resolvedArgs, action);

            frame.output = result;
            frame.end = Date.now();
            results[step.id] = result;
            return result;
          } catch (err) {
            frame.error = err;
            frame.end = Date.now();
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

  const output: O = workflow.outputResolver
    ? workflow.outputResolver({
        input,
        results: results as R,
        context: (workflow as any).__context,
      })
    : (results as unknown as O);

  return { results: results as R, output, extras };
}

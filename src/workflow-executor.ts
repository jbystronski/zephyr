// import { composeMiddleware } from "../middleware/index.js";
// import { ActionRegistry } from "../registry/types.js";
// import { WorkflowDef } from "./main.js";
// import { ExecutionFrame, WorkflowMiddleware } from "./types.js";
//
// export async function executeWorkflow<Reg extends ActionRegistry, I, R>(
//   workflow: WorkflowDef<Reg, I, R>,
//   registry: Reg,
//   input: I,
//   middleware: WorkflowMiddleware<Reg>[] = [],
// ): Promise<{ results: R; extras: Record<string, any> }> {
//   const results: Record<string, any> = {};
//   const extras: Record<string, any> = {};
//   extras.frames = {} as Record<string, ExecutionFrame>; // <-- store execution frames per step
//
//   const stepById = new Map(workflow.steps.map((s) => [s.id, s]));
//   const remainingDeps = new Map<string, number>();
//   const dependents = new Map<string, string[]>();
//   const ready: string[] = [];
//
//   // Build dependency graph
//   for (const step of workflow.steps) {
//     remainingDeps.set(step.id, step.dependsOn.length);
//     if (step.dependsOn.length === 0) ready.push(step.id);
//
//     for (const dep of step.dependsOn) {
//       if (!dependents.has(dep)) dependents.set(dep, []);
//       dependents.get(dep)!.push(step.id);
//     }
//   }
//
//   let completed = 0;
//
//   // Scheduler loop
//   while (ready.length > 0) {
//     const batch = ready.splice(0);
//
//     await Promise.all(
//       batch.map(async (stepId) => {
//         const step = stepById.get(stepId)!;
//
//         const frame: ExecutionFrame = {
//           stepId,
//           attempts: 0,
//           start: Date.now(),
//         };
//         extras.frames[stepId] = frame;
//
//         const ctx = {
//           stepId,
//           input,
//           results,
//           registry,
//           extras,
//           frame,
//         };
//
//         const core = async () => {
//           frame.attempts++;
//           frame.input = step.resolve({ input, results });
//
//           try {
//             const action = registry[step.action];
//
//             const result = await action(frame.input);
//             frame.output = result;
//             frame.end = Date.now();
//
//             results[step.id] = result;
//             return result;
//           } catch (err) {
//             frame.error = err;
//             frame.end = Date.now();
//             throw err;
//           }
//         };
//
//         const composed = composeMiddleware(middleware, ctx, core);
//         await composed();
//
//         // Activate dependents
//         for (const childId of dependents.get(stepId) ?? []) {
//           const remaining = remainingDeps.get(childId)! - 1;
//           remainingDeps.set(childId, remaining);
//           if (remaining === 0) ready.push(childId);
//         }
//
//         completed++;
//       }),
//     );
//   }
//
//   // Deadlock detection
//   if (completed !== workflow.steps.length) {
//     throw new Error("Workflow execution failed (cycle or missing dependency)");
//   }
//
//   return { results: results as R, extras };
// }

// import { composeMiddleware } from "./middleware.js";
// import { ActionRegistry, ExecutionFrame, WorkflowMiddleware } from "./types.js";
// import { StepDef, WorkflowDef } from "./workflow-composer.js";
//
// export async function executeWorkflow<Reg extends ActionRegistry, I, R, O = R>(
//   workflow: WorkflowDef<Reg, I, R, any, O>,
//   registry: Reg,
//   input: I,
//   middleware: WorkflowMiddleware<Reg>[] = [],
// ): Promise<{ results: R; output: O; extras: Record<string, any> }> {
//   const results: Record<string, any> = {};
//   const extras: Record<string, any> = {};
//   extras.frames = {} as Record<string, ExecutionFrame>;
//
//   // --- strongly type steps ---
//
//   const stepById = new Map<string, StepDef<Reg, any, any>>(
//     workflow.steps.map((s: StepDef<Reg, any, any>) => [s.id, s]),
//   );
//   const remainingDeps = new Map<string, number>();
//   const dependents = new Map<string, string[]>();
//   const ready: string[] = [];
//
//   // Build dependency graph
//   for (const step of workflow.steps) {
//     remainingDeps.set(step.id, step.dependsOn.length);
//     if (step.dependsOn.length === 0) ready.push(step.id);
//
//     for (const dep of step.dependsOn) {
//       if (!dependents.has(dep)) dependents.set(dep, []);
//       dependents.get(dep)!.push(step.id);
//     }
//   }
//
//   let completed = 0;
//
//   while (ready.length > 0) {
//     const batch = ready.splice(0);
//
//     await Promise.all(
//       batch.map(async (stepId) => {
//         const step = stepById.get(stepId)!;
//
//         const frame: ExecutionFrame = {
//           stepId,
//           attempts: 0,
//           start: Date.now(),
//         };
//         extras.frames[stepId] = frame;
//
//         const ctx = { stepId, input, results, registry, extras, frame };
//
//         const core = async () => {
//           frame.attempts++;
//           frame.input = step.resolve?.({ input, results }) ?? undefined;
//
//           try {
//             const action = registry[step.action];
//             const result =
//               frame.input === undefined
//                 ? await (action as () => Promise<any>)()
//                 : await action(frame.input);
//             // const result = await action(frame.input);
//             frame.output = result;
//             frame.end = Date.now();
//
//             results[step.id] = result;
//             return result;
//           } catch (err) {
//             frame.error = err;
//             frame.end = Date.now();
//             throw err;
//           }
//         };
//
//         const composed = composeMiddleware(middleware, ctx, core);
//         await composed();
//
//         for (const childId of dependents.get(stepId) ?? []) {
//           const remaining = remainingDeps.get(childId)! - 1;
//           remainingDeps.set(childId, remaining);
//           if (remaining === 0) ready.push(childId);
//         }
//
//         completed++;
//       }),
//     );
//   }
//
//   if (completed !== workflow.steps.length) {
//     throw new Error("Workflow execution failed (cycle or missing dependency)");
//   }
//
//   // Resolve output
//   const output: O = workflow.outputResolver
//     ? workflow.outputResolver({ input, results: results as R })
//     : (results as unknown as O);
//
//   return { results: results as R, output, extras };
// }
//
//
///// with any fn shape
// import { composeObserver } from "./observer.js";
// import { ActionRegistry, ExecutionFrame, WorkflowObserver } from "./types.js";
// import { StepDef, WorkflowDef } from "./workflow-composer.js";
//
// export async function executeWorkflow<Reg extends ActionRegistry, I, R, O = R>(
//   workflow: WorkflowDef<Reg, I, R, any, O>,
//   registry: Reg,
//   input: I,
//   observers: WorkflowObserver<Reg>[] = [],
// ): Promise<{ results: R; output: O; extras: Record<string, any> }> {
//   const results: Record<string, any> = {};
//   const extras: Record<string, any> = {};
//   extras.frames = {} as Record<string, ExecutionFrame>;
//
//   const stepById = new Map<string, StepDef<Reg, any, any>>(
//     workflow.steps.map((s: StepDef<Reg, any, any>) => [s.id, s]),
//   );
//   const remainingDeps = new Map<string, number>();
//   const dependents = new Map<string, string[]>();
//   const ready: string[] = [];
//
//   // Build dependency graph
//   for (const step of workflow.steps) {
//     remainingDeps.set(step.id, step.dependsOn.length);
//     if (step.dependsOn.length === 0) ready.push(step.id);
//
//     for (const dep of step.dependsOn) {
//       if (!dependents.has(dep)) dependents.set(dep, []);
//       dependents.get(dep)!.push(step.id);
//     }
//   }
//
//   let completed = 0;
//
//   while (ready.length > 0) {
//     const batch = ready.splice(0);
//
//     await Promise.all(
//       batch.map(async (stepId) => {
//         const step = stepById.get(stepId)!;
//
//         const frame: ExecutionFrame = {
//           stepId,
//           attempts: 0,
//           start: Date.now(),
//         };
//         extras.frames[stepId] = frame;
//         const context = (workflow as any).__context;
//         const ctx = {
//           stepId,
//           input,
//           results,
//           context,
//           registry,
//           extras,
//           frame,
//         };
//
//         const core = async () => {
//           frame.attempts++;
//
//           const stepCtx = { input, results, context };
//
//           if (step.when && !step.when(stepCtx)) {
//             frame.output = undefined;
//             frame.end = Date.now();
//             frame.skipped = true;
//             results[step.id] = undefined;
//             return undefined;
//           }
//
//           // 👇 Get the resolved arguments (should be a tuple or undefined)
//           // const resolvedArgs = step.resolve?.({ input, results, context });
//           const resolvedArgs = step.resolve?.(stepCtx);
//           frame.input = resolvedArgs;
//
//           try {
//             const action = registry[step.action];
//
//             let result;
//             if (resolvedArgs === undefined) {
//               // No arguments - call with nothing
//               result = await (action as () => Promise<any>)();
//             } else if (Array.isArray(resolvedArgs)) {
//               // Tuple arguments - spread as positional params
//               result = await action(...resolvedArgs);
//             } else {
//               // Single object argument (backward compatibility)
//               result = await action(resolvedArgs);
//             }
//
//             frame.output = result;
//             frame.end = Date.now();
//
//             results[step.id] = result;
//             return result;
//           } catch (err) {
//             frame.error = err;
//             frame.end = Date.now();
//             throw err;
//           }
//         };
//
//         const composed = composeObserver(observers, ctx, core);
//         await composed();
//
//         for (const childId of dependents.get(stepId) ?? []) {
//           const remaining = remainingDeps.get(childId)! - 1;
//           remainingDeps.set(childId, remaining);
//           if (remaining === 0) ready.push(childId);
//         }
//
//         completed++;
//       }),
//     );
//   }
//
//   if (completed !== workflow.steps.length) {
//     throw new Error("Workflow execution failed (cycle or missing dependency)");
//   }
//
//   // Resolve output
//   const output: O = workflow.outputResolver
//     ? workflow.outputResolver({ input, results: results as R })
//     : (results as unknown as O);
//
//   return { results: results as R, output, extras };
// }

/////////////////////// with for each check

// import { composeObserver } from "./observer.js";
// import { ActionRegistry, ExecutionFrame, WorkflowObserver } from "./types.js";
// import { StepDef, WorkflowDef } from "./workflow-composer.js";
//
// export async function executeWorkflow<Reg extends ActionRegistry, I, R, O = R>(
//   workflow: WorkflowDef<Reg, I, R, any, O>,
//   registry: Reg,
//   input: I,
//   observers: WorkflowObserver<Reg>[] = [],
// ): Promise<{ results: R; output: O; extras: Record<string, any> }> {
//   const results: Record<string, any> = {};
//   const extras: Record<string, any> = {};
//   extras.frames = {} as Record<string, ExecutionFrame>;
//
//   const stepById = new Map<string, StepDef<Reg, any, any>>(
//     workflow.steps.map((s: StepDef<Reg, any, any>) => [s.id, s]),
//   );
//   const remainingDeps = new Map<string, number>();
//   const dependents = new Map<string, string[]>();
//   const ready: string[] = [];
//
//   // Build dependency graph
//   for (const step of workflow.steps) {
//     remainingDeps.set(step.id, step.dependsOn.length);
//     if (step.dependsOn.length === 0) ready.push(step.id);
//
//     for (const dep of step.dependsOn) {
//       if (!dependents.has(dep)) dependents.set(dep, []);
//       dependents.get(dep)!.push(step.id);
//     }
//   }
//
//   let completed = 0;
//
//   // Main execution loop
//   while (ready.length > 0) {
//     const batch = ready.splice(0);
//
//     await Promise.all(
//       batch.map(async (stepId) => {
//         const step = stepById.get(stepId)!;
//
//         const frame: ExecutionFrame = {
//           stepId,
//           attempts: 0,
//           start: Date.now(),
//         };
//         extras.frames[stepId] = frame;
//         const context = (workflow as any).__context;
//         const ctx = {
//           stepId,
//           input,
//           results,
//           context,
//           registry,
//           extras,
//           frame,
//         };
//
//         const core = async () => {
//           frame.attempts++;
//
//           const stepCtx = { input, results, context };
//
//           // Conditional skip
//           if (step.when && !step.when(stepCtx)) {
//             frame.output = undefined;
//             frame.end = Date.now();
//             frame.skipped = true;
//             results[step.id] = undefined;
//             return undefined;
//           }
//
//           const resolvedArgs = step.resolve?.(stepCtx);
//           frame.input = resolvedArgs;
//
//           try {
//             const action = registry[step.action];
//             let result;
//
//             if (resolvedArgs === undefined) {
//               result = await (action as () => Promise<any>)();
//             } else if (Array.isArray(resolvedArgs)) {
//               result = await action(...resolvedArgs);
//             } else {
//               result = await action(resolvedArgs);
//             }
//
//             frame.output = result;
//             frame.end = Date.now();
//
//             results[step.id] = result;
//             return result;
//           } catch (err) {
//             frame.error = err;
//             frame.end = Date.now();
//             throw err;
//           }
//         };
//
//         const composed = composeObserver(observers, ctx, core);
//         await composed();
//
//         // Notify dependents
//         for (const childId of dependents.get(stepId) ?? []) {
//           const remaining = remainingDeps.get(childId)! - 1;
//           remainingDeps.set(childId, remaining);
//           if (remaining === 0) ready.push(childId);
//         }
//
//         completed++;
//       }),
//     );
//   }
//
//   if (completed !== workflow.steps.length) {
//     throw new Error("Workflow execution failed (cycle or missing dependency)");
//   }
//
//
//   // Resolve workflow output
//   const output: O = workflow.outputResolver
//     ? workflow.outputResolver({ input, results: results as R })
//     : (results as unknown as O);
//
//   return { results: results as R, output, extras };
// }

// import { composeObserver } from "./observer.js";
// import { ActionRegistry, ExecutionFrame, WorkflowObserver } from "./types.js";
// import { StepDef, WorkflowDef } from "./workflow-composer.js";
//
// export async function executeWorkflow<Reg extends ActionRegistry, I, R, O = R>(
//   workflow: WorkflowDef<Reg, I, R, any, O>,
//   registry: Reg,
//   input: I,
//   observers: WorkflowObserver<Reg>[] = [],
// ): Promise<{ results: R; output: O; extras: Record<string, any> }> {
//   const results: Record<string, any> = {};
//   const extras: Record<string, any> = {};
//   extras.frames = {} as Record<string, ExecutionFrame>;
//
//   const stepById = new Map<string, StepDef<Reg, any, any>>(
//     workflow.steps.map((s: StepDef<Reg, any, any>) => [s.id, s]),
//   );
//   const remainingDeps = new Map<string, number>();
//   const dependents = new Map<string, string[]>();
//   const ready: string[] = [];
//
//   // Build dependency graph
//   for (const step of workflow.steps) {
//     remainingDeps.set(step.id, step.dependsOn.length);
//     if (step.dependsOn.length === 0) ready.push(step.id);
//
//     for (const dep of step.dependsOn) {
//       if (!dependents.has(dep)) dependents.set(dep, []);
//       dependents.get(dep)!.push(step.id);
//     }
//   }
//
//   let completed = 0;
//
//   // Main execution loop
//   while (ready.length > 0) {
//     const batch = ready.splice(0);
//
//     await Promise.all(
//       batch.map(async (stepId) => {
//         const step = stepById.get(stepId)!;
//
//         const frame: ExecutionFrame = {
//           stepId,
//           attempts: 0,
//           start: Date.now(),
//         };
//         extras.frames[stepId] = frame;
//         const context = (workflow as any).__context;
//         const ctx = {
//           stepId,
//           input,
//           results,
//           context,
//           registry,
//           extras,
//           frame,
//         };
//
//         const core = async () => {
//           frame.attempts++;
//
//           const stepCtx = { input, results, context };
//
//           // Conditional skip
//           if (step.when && !step.when(stepCtx)) {
//             frame.output = undefined;
//             frame.end = Date.now();
//             frame.skipped = true;
//             results[step.id] = undefined;
//             return undefined;
//           }
//
//           const resolvedArgs = step.resolve?.(stepCtx);
//           frame.input = resolvedArgs;
//
//           try {
//             const action = registry[step.action];
//             let result;
//
//             // Handle loop flag
//
//             // DEBUG: Log what's happening
//             if (step.loop) {
//               if (!Array.isArray(resolvedArgs)) {
//                 throw new Error(
//                   `Step "${step.id}" with loop=true must return an array`,
//                 );
//               }
//
//               result = await Promise.all(
//                 resolvedArgs.map(async (item) => {
//                   if (Array.isArray(item)) {
//                     return await action(...item);
//                   } else {
//                     return await action(item);
//                   }
//                 }),
//               );
//               // if (
//               //   resolvedArgs &&
//               //   resolvedArgs[0] &&
//               //   Array.isArray(resolvedArgs[0])
//               // ) {
//               //   const items = resolvedArgs[0];
//               //
//               //   result = await Promise.all(
//               //     items.map(async (item, idx) => {
//               //       return await action(item);
//               //     }),
//               //   );
//               // } else {
//               //   if (resolvedArgs === undefined) {
//               //     result = await (action as () => Promise<any>)();
//               //   } else if (Array.isArray(resolvedArgs)) {
//               //     result = await action(...resolvedArgs);
//               //   } else {
//               //     result = await action(resolvedArgs);
//               //   }
//               // }
//             } else {
//               // Normal execution
//               if (resolvedArgs === undefined) {
//                 result = await (action as () => Promise<any>)();
//               } else if (Array.isArray(resolvedArgs)) {
//                 result = await action(...resolvedArgs);
//               } else {
//                 result = await action(resolvedArgs);
//               }
//             }
//
//             frame.output = result;
//             frame.end = Date.now();
//
//             results[step.id] = result;
//             return result;
//           } catch (err) {
//             frame.error = err;
//             frame.end = Date.now();
//             throw err;
//           }
//         };
//
//         const composed = composeObserver(observers, ctx, core);
//         await composed();
//
//         // Notify dependents
//         for (const childId of dependents.get(stepId) ?? []) {
//           const remaining = remainingDeps.get(childId)! - 1;
//           remainingDeps.set(childId, remaining);
//           if (remaining === 0) ready.push(childId);
//         }
//
//         completed++;
//       }),
//     );
//   }
//
//   if (completed !== workflow.steps.length) {
//     throw new Error("Workflow execution failed (cycle or missing dependency)");
//   }
//
//   // Resolve workflow output
//   const output: O = workflow.outputResolver
//     ? workflow.outputResolver({ input, results: results as R })
//     : (results as unknown as O);
//
//   return { results: results as R, output, extras };
// }
// ///////////////////////////////////////////////////////////////
//
//
import { composeObserver } from "./observer.js";
import { ActionRegistry, ExecutionFrame, WorkflowObserver } from "./types.js";
import {
  StepDef,
  WorkflowDef,
  ResolvedStepInput,
} from "./workflow-composer.js";

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
          const stepCtx = { input, results, context };

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

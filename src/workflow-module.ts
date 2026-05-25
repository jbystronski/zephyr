import { compileModule, compileWorkflow } from "./ast-compiler.js";
import { createExecutor } from "./executor.js";
import { COMPILED_GRAPH, DEPS, MODULE_ID, UNSET } from "./symbols.js";
import {
  ExecutionPlan,
  Module,
  Runtime,
  RuntimeOptions,
  ServiceMetaRegistry,
  ServiceRegistry,
  WorkflowInput,
  WorkflowOutput,
} from "./types.js";

import { createWorkflow, WorkflowDef } from "./workflow-composer.js";

// export function createModule<S extends ServiceRegistry>() {
//   const wf = createWorkflow<S>();
//
//   return function <WFs extends Record<string, WorkflowDef<any, any>>>(
//     define: (ctx: { wf: ReturnType<typeof createWorkflow<S>> }) => WFs,
//   ): Module<S, WFs> {
//     const workflows = define({ wf }) as Module<S, WFs>;
//
//     return Object.assign(workflows, {
//       _services: null as unknown as S,
//     }) as Module<S, WFs>;
//   };
// }
//

export function createModule<S extends ServiceRegistry>() {
  const wf = createWorkflow<S>();

  return function <WFs extends Record<string, WorkflowDef<any, any>>>(
    define: (ctx: { wf: ReturnType<typeof createWorkflow<S>> }) => WFs,
  ): Module<S, WFs> {
    return define({ wf }) as Module<S, WFs>;
  };
}

// return {
//   run: async <K extends keyof M["__public"]>(
//     workflowId: K,
//     input: WorkflowInput<M["__public"][K]>,
//     observers: WorkflowObserver[] = [],
//   ): Promise<{
//     output: WorkflowOutput<M["__public"][K]>;
//     extras: Record<string, any>;
//   }> => {
//     const plan = compiled[COMPILED_GRAPH][workflowId as string];
//
//     if (!plan) {
//       throw new Error(`Workflow not found: ${String(workflowId)}`);
//     }
//
//     const executor = createExecutor(plan, services, observers);
//
//     const results = new Array(plan.maxIndex + 1);
//     // results.fill(UNSET);
//
//     if (typeof plan.initIdx === "number") {
//       results[plan.initIdx] = input;
//     }
//
//     const output = await executor(results, {});
//     // const output = await executePlan(plan, input, results, observers);
//
//     return {
//       output,
//       extras: {},
//     };
//   },
// };

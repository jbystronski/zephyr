import { Module, ServiceRegistry, WorkflowDef } from "./types.js";

import { createWorkflow } from "./workflow-composer.js";

export function createModule<S extends ServiceRegistry>() {
  const wf = createWorkflow<S>();

  return function <WFs extends Record<string, WorkflowDef<any, any>>>(
    define: (ctx: { wf: ReturnType<typeof createWorkflow<S>> }) => WFs,
  ): Module<S, WFs> {
    return define({ wf }) as Module<S, WFs>;
  };
}

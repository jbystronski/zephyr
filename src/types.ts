import { createWorkflow } from "./workflow-composer.js";

export type Action<I = any, O = any> = (args: I) => Promise<O>;

export interface ActionRegistry {
  [key: string]: Action;
}

export type MergeActionRegistries<
  A extends ActionRegistry,
  B extends ActionRegistry,
> = Omit<A, keyof B> & B;

export type ExecutionFrame = {
  stepId: string;
  attempts: number;
  start: number;
  end?: number;
  input?: any;
  output?: any;
  error?: any;
};

export type WorkflowMiddleware<Reg extends ActionRegistry = any> = {
  (
    ctx: {
      stepId: string;
      input: any;
      results: Record<string, any>;
      registry: Reg;
      extras: Record<string, any>;
      frame: ExecutionFrame;
    },
    next: () => Promise<any>,
  ): Promise<any>;
};

export type WF<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
> = ReturnType<typeof createWorkflow<Reg, Context>>;

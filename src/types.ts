// import { createWorkflow } from "./workflow-composer.js";
//
// export type Action<I = any, O = any> = (args: I) => Promise<O>;
//
// export interface ActionRegistry {
//   [key: string]: Action;
// }
//
// export type MergeActionRegistries<
//   A extends ActionRegistry,
//   B extends ActionRegistry,
// > = Omit<A, keyof B> & B;
//
// export type ExecutionFrame = {
//   stepId: string;
//   attempts: number;
//   start: number;
//   end?: number;
//   input?: any;
//   output?: any;
//   error?: any;
// };
//
// export type WorkflowMiddleware<Reg extends ActionRegistry = any> = {
//   (
//     ctx: {
//       stepId: string;
//       input: any;
//       results: Record<string, any>;
//       registry: Reg;
//       extras: Record<string, any>;
//       frame: ExecutionFrame;
//     },
//     next: () => Promise<any>,
//   ): Promise<any>;
// };
//
// export type WF<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
// > = ReturnType<typeof createWorkflow<Reg, Context>>;
// // TODO: this needs enforcing
// type Observer = (
//   frame: Readonly<ExecutionFrame>,
//   extras: Record<string, any>,
// ) => void | Promise<void>;

import { createWorkflow } from "./workflow-composer.js";

export type Action<
  F extends (...args: any[]) => any = (...args: any[]) => any,
> = F;

// export interface ActionRegistry {
//   [key: string]: Action;
// }
export type ActionRegistry = Record<string, (...args: any[]) => any>;
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

// export type ActionParams<
//   Reg extends ActionRegistry,
//   K extends keyof Reg,
// > = Parameters<Reg[K]>;
//
// // 👇 Helper to extract return type from any action (unwraps Promise)
// export type ActionReturn<
//   Reg extends ActionRegistry,
//   K extends keyof Reg,
// > = Awaited<ReturnType<Reg[K]>>;

export type ActionParams<Reg, K extends keyof Reg> = Reg[K] extends (
  ...args: infer P
) => any
  ? P
  : never;

export type ActionReturn<Reg, K extends keyof Reg> = Reg[K] extends (
  ...args: any[]
) => infer R
  ? Awaited<R>
  : never;

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
// TODO: this needs enforcing
type Observer = (
  frame: Readonly<ExecutionFrame>,
  extras: Record<string, any>,
) => void | Promise<void>;

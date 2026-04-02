import { createWorkflow } from "./workflow-composer.js";

export type Action<
  F extends (...args: any[]) => any = (...args: any[]) => any,
> = F;

export type ActionRegistry = Record<string, (...args: any[]) => any>;
export type MergeActionRegistries<
  A extends ActionRegistry,
  B extends ActionRegistry,
> = Simplify<Omit<A, keyof B> & B>;

export type ExecutionFrame = {
  stepId: string;
  attempts: number;
  start: number;
  end?: number;
  input?: any;
  output?: any;
  error?: any;
  skipped?: boolean;
};

export type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

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

export type WorkflowObserver<Reg extends ActionRegistry = any> = {
  (
    ctx: {
      stepId: string;
      input: any;
      results: Record<string, any>;
      actionRegistry: Reg;
      extras: Record<string, any>;
      frame: ExecutionFrame;
    },
    next: () => Promise<any>,
  ): Promise<any>;
};

export interface Executor {
  run: (
    wfId: string,
    input: Record<string, any>,
    services: ServiceRegistry,
    obsververs?: WorkflowObserver[],
  ) => Promise<any>;
}

// TODO: this needs enforcing
type Observer = (
  frame: Readonly<ExecutionFrame>,
  extras: Record<string, any>,
) => void | Promise<void>;

// workflow-composer

export type ServiceRegistry = Record<
  string,
  Record<string, (...args: any[]) => any>
>;

export type ServiceParams<
  S extends ServiceRegistry,
  K extends keyof S,
  M extends keyof S[K],
> = Parameters<S[K][M]>;

export type ServiceReturn<
  S extends ServiceRegistry,
  K extends keyof S,
  M extends keyof S[K],
> = Awaited<ReturnType<S[K][M]>>;

export type NormalizedCall =
  | { kind: "none" }
  | { kind: "positional"; args: any[] }
  | { kind: "object"; args: any };

export type CallHelpers<
  Reg extends ActionRegistry,
  ActionName extends keyof Reg,
> = {
  args: (...args: ActionParams<Reg, ActionName>) => {
    kind: "positional";
    args: ActionParams<Reg, ActionName>;
  };

  obj: ActionParams<Reg, ActionName> extends [infer A]
    ? (arg: A) => { kind: "object"; args: A }
    : never;

  none: () => { kind: "none" };
  // loop: (
  //   items:
  //     | { kind: "positional"; args: ActionParams<Reg, ActionName> }[]
  //     | { kind: "object"; args: ActionParams<Reg, ActionName>[0] }[],
  // ) => {
  //   kind: "loop";
  //   items: typeof items;
  // };
};

/// pipe

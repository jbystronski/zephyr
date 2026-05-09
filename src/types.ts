import {
  arrayLib,
  dateLib,
  extendedJsonLib,
  logicLib,
  mathLib,
  miscLib,
  objectLib,
  stdLib,
  stringLib,
} from "./services.js";

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

export type WorkflowObserver<S extends ServiceRegistry = any> = {
  (
    ctx: {
      stepId: string;
      input: any;
      results: Record<string, any>;

      extras: Record<string, any>;
      frame: ExecutionFrame;
    },
    next: () => Promise<any>,
  ): Promise<any>;
};

export type ServiceRegistry = Record<
  string,
  Record<string, (...args: any[]) => any>
>;

export type StandardServices = {
  std: typeof stdLib;
  date_std: typeof dateLib;
  string_std: typeof stringLib;
  math_std: typeof mathLib;
  array_std: typeof arrayLib;
  object_std: typeof objectLib;
  logic_std: typeof logicLib;
  misc_std: typeof miscLib;
  extended_json_std: typeof extendedJsonLib;
};

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

// export type Guard = number | { not: number };

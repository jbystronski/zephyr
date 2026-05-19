import {
  arrayLib,
  dateLib,
  errLib,
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
  value?: any;
  error?: any;
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
  date: typeof dateLib;
  string: typeof stringLib;
  math: typeof mathLib;
  array: typeof arrayLib;
  object: typeof objectLib;
  logic: typeof logicLib;
  misc: typeof miscLib;
  extended_json: typeof extendedJsonLib;
  err: typeof errLib;
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

export type ServiceMeta = {
  async?: boolean;
};

export type ServiceMetaRule = {
  async?: boolean;
};

export type ServiceMetaRegistry<S extends Record<string, any>> = {
  [K in keyof S]?: {
    service?: ServiceMetaRule;
    methods?: Record<string, ServiceMeta>;
    patterns?: Array<{
      match: RegExp;
      meta: ServiceMeta;
    }>;
  };
};

export type StepSpec =
  | "__init__"
  | "__eval__"
  | "__out__"
  | "__pipe__"
  | "__join__";

export type PipeMode = "map" | "filter" | "find" | "some" | "every" | "count";

// -----------------------------------
// AST
// -----------------------------------

export type Primitive = string | number | boolean | null;

export type Expr =
  | Primitive
  | Expr[]
  | { [k: string]: Expr }
  | RefExpr
  | CallExpr;

export type RefExpr = {
  __ref: number;
  __path?: (string | number | symbol)[];
};

export type CallExpr = {
  __service: string;
  __method: string;
  __args?: Expr[];
};

export type ExprValue<T> = T & {
  __expr: Expr;
};

export type GetterProxy<T> = T & {
  __expr: Expr;
};

export type ExprServiceCtx<S extends ServiceRegistry> = {
  [SK in keyof S]: {
    [MK in keyof S[SK]]: (
      ...args: Parameters<S[SK][MK]>
    ) => ExprValue<Awaited<ReturnType<S[SK][MK]>>>;
  };
};

export type ExprCtx<S extends ServiceRegistry, Results> = ExprServiceCtx<S> & {
  get<K extends keyof Results>(key: K): Results[K];
};

// -----------------------------------
// Compiler / Executor
// -----------------------------------

export type CompilerCtx<S = any, M = any> = {
  services: S;
  meta: M;
};

export type ResultsArray = any[] & { __parent?: ResultsArray };

export type ExecutionPlan = {
  levels: CompiledStep[][];
  outputIndex?: number;
  exitIndexes: number[];
  maxIndex: number;
};

export type CompiledStep = {
  id: string;
  idx: number; // graph id (debug)
  deps: number[];
  guards: number[];
  spec?: StepSpec;
  // resolve: CompiledExpr | null;
  resolve: StepExecutor | null;
  pipe?: {
    mode: PipeMode;
    plan: ExecutionPlan;
  };
};

export type StepRuntimeCtx = {
  input: any;
  results: ResultsArray;
  observers: any[];
  frame?: ExecutionFrame;
};

export type CompiledStepRuntime = (ctx: StepRuntimeCtx) => Promise<any>;

export type CompiledExpr =
  | any
  | CompiledExpr[]
  | Record<string, any>
  | ((rt: StepRuntimeCtx) => any | Promise<any>);

export type StepExecutor = (rt: StepRuntimeCtx) => any;

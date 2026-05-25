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
import { DEPS, EXEC_GRAPH, MODULE_ID } from "./symbols.js";
import { createWorkflow } from "./workflow-composer.js";

export type WorkflowDef<
  Input,
  // Results,
  // Steps extends StepDef<any>[] = StepDef<any>[],
  Output = undefined,
> = {
  name?: string;
  __id: string;
  steps: StepDef<any>[];
  // entrySteps: StepDef<any>[];
  endSteps: StepDef<any>[];
  // input: Input;
  // results: Results;
  outputIdx?: number;
  initIdx?: number;
  guards: number[];
  // aliasMap: {
  //   results: Record<string, string>;
  // };
};

export type WFConfig<Input, Services> = {
  input: Input;
  services: Services;
};

export type PipeResult<Mode extends PipeMode, Item> = Mode extends "map"
  ? Item[]
  : Mode extends "filter"
    ? Item[]
    : Mode extends "find"
      ? Item | undefined
      : Mode extends "some" | "every"
        ? boolean
        : Mode extends "count"
          ? number
          : never;

export type PipeNode = {
  // type: "pipe";
  // input: ExprNode;
  // input: Expr;
  mode: PipeMode;

  workflow: {
    __id: string;
    // name: string;

    steps: StepDef<any>[];

    //TODO: add guards here?
    // guards: number[]
    // entrySteps: StepDef<any>[];
    endSteps: StepDef<any>[];

    // aliasMap: {
    //   results: Record<string, string>;
    // };
  };

  // entryMap: Record<string, string>;
  exitMap: number[];
};

export type WorkflowInput<T> = T extends WorkflowDef<infer I, any> ? I : never;

export type WorkflowOutput<T> =
  T extends WorkflowDef<any, infer O>
    ? unknown extends O
      ? undefined
      : O
    : undefined;

type StepCtx<R> = {
  results: R;
};

export type StepDef<ID extends string = string> = {
  id: ID;
  idx: number;
  dependsOn: number[];
  guards?: number[];
  // resolve: ExprNode | null;
  resolve: Expr;
  options?: StepOptions<any>;
  spec?: StepSpec;
  pipe?: PipeNode;
};

export type StepOptions<Results> = {
  retry?: number;
  retryDelay?: number | ((attempt: number) => number);
  timeout?: number;

  continueOnError?: boolean;

  onError?: (err: unknown, ctx: StepCtx<Results>) => any;
  pipe?: {
    parallel?: boolean;
  };

  // optional later:
  label?: string;
  meta?: Record<string, any>;
};

export type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

export type WorkflowObserver = {
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
// UTILS
// -----------------------------------

type UnionToIntersection<U> = (U extends any ? (x: U) => any : never) extends (
  x: infer I,
) => any
  ? I
  : never;

// -----------------------------------
// MODULE
// -----------------------------------

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

type PropertyKey = string | number | symbol;

export type RefExpr = {
  __ref: number;
  __path?: PropertyKey[];
};

export type CallExpr = {
  __service: string;
  __method: string;
  __args?: Expr[];
  __path?: PropertyKey[];
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

export type ExecutionFrame = {
  stepId: string;
  attempts: number;
  start: number;
  end?: number;
  value?: any;
  error?: any;
};

export type CompilerCtx<M = any> = {
  meta: M;
};

export type ResultsArray = any[] & { __parent?: ResultsArray };

export type ExecutionPlan = {
  initIdx?: number;
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
  resolve: StepExecutor | null;
  pipe?: {
    mode: PipeMode;
    plan: ExecutionPlan;
  };
};

export type StepRuntimeCtx = {
  services: Record<string, unknown>;
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

// export type ExtractServices<M> = M extends { [__services]: infer S }
//   ? S
//   : never;

// export type RuntimeServices<MM extends Record<string, Module<any, any>>> =
//   UnionToIntersection<ExtractServices<MM[keyof MM]>>;

export type RuntimeOptions<MM extends Record<string, Module<any, any>>> = {
  global?: {
    precompile?: boolean;
    observers?: WorkflowObserver[];
  };

  modules?: {
    [M in keyof MM]?: {
      precompile?: boolean;
      observers?: WorkflowObserver[];
    };
  };

  workflows?: {
    [M in keyof MM]?: {
      [W in keyof MM[M]]?: {
        precompile?: boolean;
        observers?: WorkflowObserver[];
      };
    };
  };
};

// export type UnionServices<MM> = MM[keyof MM] extends infer M
//   ? M extends Module<any, any>
//     ? M extends Module<infer S, any>
//       ? S
//       : never
//     : never
//   : never;

export type Runtime<MM extends Record<string, Module<any, any>>> = {
  run<M extends keyof MM & string, K extends keyof MM[M] & string>(
    modKey: M,
    workflow: K,
    input: WorkflowInput<MM[M][K]>,
  ): Promise<{
    output: WorkflowOutput<MM[M][K]>;
    extras: Record<string, unknown>;
  }>;
};

// declare const __services: unique symbol;

// export type Module<
//   S extends ServiceRegistry,
//   WF extends Record<string, WorkflowDef<any, any>>,
// > = WF & {
//   __services: S;
// };

export type Module<
  S extends ServiceRegistry,
  WF extends Record<string, WorkflowDef<any, any>>,
> = WF;

import { arrayLib } from "./services/array.js";
import { stdLib } from "./services/base.js";
import { dateLib } from "./services/date.js";
import { errLib } from "./services/error.js";
import { extendedJsonLib } from "./services/extended-json.js";
import { logicLib } from "./services/logic.js";
import { mathLib } from "./services/math.js";
import { miscLib } from "./services/misc.js";
import { objectLib } from "./services/object.js";
import { stringLib } from "./services/string.js";
import { DEPS, EXEC_GRAPH, MODULE_ID } from "./symbols.js";

export type WorkflowDef<Input, Output = undefined> = {
  name?: string;
  __id: string;
  __stack: string[];
  steps: StepDef<any>[];
  endSteps: StepDef<any>[];
  outputIdx?: number;
  initIdx?: number;
  guards: number[];
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
  mode: PipeMode;

  workflow: {
    __id: string;

    steps: StepDef<any>[];

    //TODO: add guards here?
    // guards: number[]

    endSteps: StepDef<any>[];
  };

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

  resolve: Expr;
  options?: StepOptions;
  spec?: StepSpec;
  pipe?: PipeNode;
};

export type StepOptions = {
  timeout?: number;

  retry?: {
    count: number;
    delay?: number;
  };

  fallback?: unknown;

  swallow?: boolean;

  optional?: boolean;

  cache?: {
    ttl?: number;
    key?: string;
  };

  concurrency?: {
    limit?: number;
  };
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

export type IRStepResolve = {
  __service?: string;
  __method?: string;
  __ref?: number;
  __path?: string[];
  __args?: (IRStepResolve | Primitive)[];
  [x: string]: any;
};

export type IRStep = {
  id: string;
  idx: number;
  resolve: IRStepResolve;
  dependsOn: number[];
  guards: number[];
  options?: StepOptions;
};
export type IR = {
  __id: string;
  name: string;
  steps: IRStep[];
  guards: number[];
  endSteps: IRStep[];
  outputIdx?: number;
  initIdx?: number;
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
  options?: StepOptions;
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

type AvailableOpts = {
  observers?: WorkflowObserver[];
};

export type RuntimeOptions = {
  global?: AvailableOpts;

  workflows?: {
    ids: string[];
    options: AvailableOpts;
  };
};

export type Runtime = {
  run<WF extends WorkflowDef<any, any>>(
    wf: WF,

    input: WorkflowInput<WF>,
  ): Promise<{
    output: WorkflowOutput<WF>;
    extras: Record<string, unknown>;
  }>;
};

export type Module<
  S extends ServiceRegistry,
  WF extends Record<string, WorkflowDef<any, any>>,
> = WF;

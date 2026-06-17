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

export type WorkflowDef<I, O> = {
  __id: string;
  __stack: string[];
  steps: StepDef[];
  outputIdx?: number;
  initIdx?: number;
  guards: number[];
};

// export type StepKey = string;

export type StepSchema = Record<string, any>;

export type WorkflowInput<T> = T extends WorkflowDef<infer I, any> ? I : never;

export type WorkflowOutput<T> =
  T extends WorkflowDef<any, infer O>
    ? unknown extends O
      ? undefined
      : O
    : undefined;

export type StepDef = {
  id: string;
  idx: number;
  deps: number[];
  // dependsOn: number[];
  guards?: number[];
  resolve: Expr;
  options?: StepOptions;
  spec?: StepSpec;
  pipeMode?: PipeMode;
  ast?: WorkflowDef<any, any>;
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

export type StepSpec = "__pipe__" | "__sub__";

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

export type ExecutionPlan = {
  initIdx?: number;
  levels: CompiledStep[][];
  outputIndex?: number;

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
  pipeMode?: PipeMode;
  plan?: ExecutionPlan;
};

export type StepRuntimeCtx = {
  services: Record<string, unknown>;
  results: any[];
  observers: any[];
  frame?: ExecutionFrame;
};

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

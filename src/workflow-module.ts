import { ActionRegistry, Simplify, WorkflowObserver } from "./types.js";
import { createWorkflow, WorkflowDef } from "./workflow-composer.js";
import { executeWorkflow } from "./workflow-executor.js";

type AnyWorkflow = WorkflowDef<any, any, any, any, any>;

type WorkflowFromDeps<Deps extends Record<string, any>> = {
  [K in keyof Deps]: Deps[K] extends Module<any, any, infer Own, infer SubDeps>
    ? Own[keyof Own] | WorkflowFromDeps<SubDeps>
    : never;
}[keyof Deps];
type ModuleShape = Record<string, AnyWorkflow>;

type ContextFromDeps<Deps> = [keyof Deps] extends [never]
  ? {} // 👈 THIS is the fix
  : {
      [K in keyof Deps]: Deps[K] extends Module<any, infer Ctx, any, any>
        ? Ctx
        : never;
    }[keyof Deps];

type FinalContext<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Deps extends ModuleMap<Reg>,
> = Context & ContextFromDeps<Deps>;

type ModuleMap<Reg extends ActionRegistry> = Record<
  string,
  Module<Reg, any, any, any>
>;

// type Module<Own extends ModuleShape = {}, Deps extends ModuleMap = {}> = Own & {
//   deps: Deps;
// };
export type WorkflowInput<W> =
  W extends WorkflowDef<any, infer I, any, any, any> ? I : never;

export type WorkflowResults<W> =
  W extends WorkflowDef<any, any, infer R, any, any> ? R : never;

export type WorkflowOutput<W> =
  W extends WorkflowDef<any, any, any, any, infer O> ? O : never;
type Module<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Own extends ModuleShape = {},
  Deps extends ModuleMap<Reg> = {},
> = {
  own: Own;
  deps: Deps;
  createRuntime: (config: {
    registry: Reg;
    context: FinalContext<Reg, Context, Deps>;
  }) => {
    run: <W extends Own[keyof Own] | WorkflowFromDeps<Deps>>(
      workflow: W,
      input: WorkflowInput<W>,
      obververs?: WorkflowObserver<Reg>[],
    ) => Promise<{
      results: WorkflowResults<W>;
      output: WorkflowOutput<W>;
      extras: Record<string, any>;
    }>;
    getContext: () => FinalContext<Reg, Context, Deps>;
  };
};

export type ModuleContext<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Deps extends ModuleMap<Reg>,
> = {
  wf: ReturnType<typeof createWorkflow<Reg, Context>>;

  deps: Deps;
  context: Context;

  tools: <T>(
    factory: (ctx: {
      wf: ModuleContext<Reg, Context, Deps>["wf"];
      deps: Deps;
      context: Context;
    }) => T,
  ) => T;
};

export function createModule<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Use extends ModuleMap<Reg>,
  Own extends ModuleShape,
>(config: {
  use?: Use;
  define: (ctx: ModuleContext<Reg, Context, Use>) => Own;
}): Module<Reg, Context, Own, Use> {
  const wf = createWorkflow<Reg, Context>();

  const deps = (config.use ?? {}) as Use;

  const moduleCtx: ModuleContext<Reg, Context, Use> = {
    wf,
    deps,
    context: {} as Context,

    tools: (factory) =>
      factory({
        wf,
        deps,
        context: {} as Context,
      }),
  };

  const own = config.define(moduleCtx);

  return {
    own,
    deps,
    createRuntime({ registry, context }) {
      const runtimeCtx = { ...context } as FinalContext<Reg, Context, Use>;
      return {
        run: async (workflow, input, observers = []) => {
          return executeWorkflow(workflow, registry, input, context, observers);
        },
        getContext: () => ({ ...runtimeCtx }),
      };
    },
  };
}

export function createModuleFactory<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
>() {
  return function <
    Use extends ModuleMap<Reg> = {},
    Own extends ModuleShape = {},
  >(config: {
    use?: Use;
    define: (ctx: ModuleContext<Reg, Context, Use>) => Own;
  }): Module<Reg, Context, Own, Use> {
    return createModule<Reg, Context, Use, Own>(config);
  };
}

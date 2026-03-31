import {
  ActionRegistry,
  Executor,
  Simplify,
  WorkflowObserver,
} from "./types.js";
import { createWorkflow, WorkflowDef } from "./workflow-composer.js";
import { executeWorkflow } from "./workflow-executor.js";
type UnionToIntersection<U> = (U extends any ? (x: U) => any : never) extends (
  x: infer I,
) => any
  ? I
  : never;
/* ------------------------------------------------ */
/* WORKFLOW REGISTRY TYPES                          */
/* ------------------------------------------------ */
type EnsureWorkflowRecord<T> =
  T extends Record<string, WorkflowDef<any, any, any, any, any>>
    ? T
    : Record<string, WorkflowDef<any, any, any, any, any>>;

type EnsureWorkflowShape<T> = {
  [K in keyof T]: T[K] extends WorkflowDef<any, any, any, any, any>
    ? T[K]
    : never;
};

type DepWorkflows<Deps extends ModuleMap> = keyof Deps extends never
  ? {}
  : Simplify<
      EnsureWorkflowShape<
        UnionToIntersection<
          {
            [D in keyof Deps & string]: {
              [K in keyof Deps[D]["workflows"] &
                string as `${D}.${K}`]: Deps[D]["workflows"][K];
            };
          }[keyof Deps & string]
        >
      >
    >;

type WorkflowRegistry<Own extends ModuleShape, Deps extends ModuleMap> = Own &
  DepWorkflows<Deps>;

/* ------------------------------------------------ */
/* MODULE TYPES                                     */
/* ------------------------------------------------ */

type AnyWorkflow = WorkflowDef<any, any, any, any, any>;
type ModuleShape = Record<string, AnyWorkflow>;
type ModuleMap = Record<string, Module<any, any, any, any>>;

// type ContextFromDeps<Deps> = [keyof Deps] extends [never]
//   ? {}
//   : {
//       [K in keyof Deps]: Deps[K] extends Module<any, infer Ctx, any, any>
//         ? Ctx
//         : never;
//     }[keyof Deps];

type FinalContext<
  Context extends Record<string, any>,
  Deps extends ModuleMap,
> = Context & ContextFromDepsRecursive<Deps>;

// type ContextFromDeps<Deps> = [keyof Deps] extends [never]
//   ? {}
//   : UnionToIntersection<
//       {
//         [K in keyof Deps]: Deps[K] extends Module<any, infer Ctx, any, any>
//           ? Ctx
//           : never;
//       }[keyof Deps]
//     >;

type ContextFromDepsRecursive<Deps extends ModuleMap> = [keyof Deps] extends [
  never,
]
  ? {} // no deps
  : UnionToIntersection<
      {
        [K in keyof Deps]: Deps[K] extends Module<
          any,
          infer Ctx,
          any,
          infer SubDeps
        >
          ? Ctx & ContextFromDepsRecursive<SubDeps>
          : never;
      }[keyof Deps]
    >;

/* ------------------------------------------------ */
/* WORKFLOW IO TYPES                                */
/* ------------------------------------------------ */

export type WorkflowInput<W> =
  W extends WorkflowDef<any, infer I, any, any, any> ? I : never;

export type WorkflowResults<W> =
  W extends WorkflowDef<any, any, infer R, any, any> ? R : never;

export type WorkflowOutput<W> =
  W extends WorkflowDef<any, any, any, any, infer O> ? O : never;

/* ------------------------------------------------ */
/* MODULE RUNTIME                                   */
/* ------------------------------------------------ */

type Module<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Own extends ModuleShape,
  Deps extends ModuleMap,
> = {
  workflows: Own;
  __getExecutor: () => Executor;

  createRuntime: (config: { context: FinalContext<Context, Deps> }) => {
    run: <K extends keyof WorkflowRegistry<Own, Deps>>(
      workflow: K,
      input: WorkflowInput<WorkflowRegistry<Own, Deps>[K]>,
      observers?: WorkflowObserver<Reg>[],
    ) => Promise<{
      // results: WorkflowResults<WorkflowRegistry<Own, Deps>[K]>;
      output: WorkflowOutput<WorkflowRegistry<Own, Deps>[K]>;
      extras: Record<string, any>;
    }>;

    getContext: () => FinalContext<Context, Deps>;
  };
};

/* ------------------------------------------------ */
/* MODULE CONTEXT (FIXED)                           */
/* ------------------------------------------------ */

type ModuleContext<
  Reg extends ActionRegistry,
  WFReg extends Record<string, WorkflowDef<any, any, any, any, any>>,
  Context extends Record<string, any>,
> = {
  wf: ReturnType<typeof createWorkflow<Reg, WFReg, Context>>;
  context: Context;
};

function createModule<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Use extends ModuleMap,
  Own extends ModuleShape,
>(config: {
  actionRegistry: Reg;
  use?: Use;
  define: (ctx: ModuleContext<Reg, DepWorkflows<Use>, Context>) => Own;
}): Module<Reg, Context, Own, Use> {
  const deps = (config.use ?? {}) as Use;

  const wf = createWorkflow<Reg, DepWorkflows<Use>, Context>();

  const own = config.define({
    wf,
    context: {} as Context,
  });

  function buildWorkflowMap(): WorkflowRegistry<Own, Use> {
    const depWFs = Object.fromEntries(
      Object.entries(deps).flatMap(([name, mod]) =>
        Object.entries(mod.workflows).map(([k, wf]) => [`${name}.${k}`, wf]),
      ),
    );

    return { ...own, ...depWFs } as WorkflowRegistry<Own, Use>;
  }

  const workflowMap = buildWorkflowMap();

  const depsExecutors = Object.fromEntries(
    Object.entries(deps).map(([name, mod]) => [name, mod.__getExecutor()]),
  );

  const executor: Executor = {
    run(wfId, input, context, observers = []) {
      const workflow = workflowMap[wfId];

      if (!workflow) {
        throw new Error(`Workflow not found: ${String(wfId)}`);
      }

      return executeWorkflow({
        workflow,
        actionRegistry: config.actionRegistry,
        depsExecutors,
        input,
        context,
        observers,
      });
    },
  };

  return {
    workflows: own,
    __getExecutor: () => executor,

    createRuntime({ context }) {
      let runtimeActions = config.actionRegistry;

      return {
        run: async <K extends keyof WorkflowRegistry<Own, Use>>(
          workflowId: K,
          input: WorkflowInput<WorkflowRegistry<Own, Use>[K]>,
          observers: WorkflowObserver<Reg>[] = [],
        ) => {
          return executor.run(workflowId as string, input, context, observers);
        },

        getContext: () => ({ ...context }) as FinalContext<Context, Use>,

        setActionRegistry(reg: Reg) {
          runtimeActions = reg;
          // ⚠️ optional: if you REALLY want override, you'd need:
          // executor.actions = reg
          // but better keep actions immutable
        },
      };
    },
  };
}

/* ------------------------------------------------ */
/* FACTORY (FIXED)                                  */
/* ------------------------------------------------ */

export function createModuleFactory<
  // Reg extends ActionRegistry,
  Context extends Record<string, any>,
>() {
  return function <
    Reg extends ActionRegistry = Record<string, any>,
    Use extends ModuleMap = {},
    Own extends ModuleShape = {},
  >(config: {
    actionRegistry: Reg;
    use?: Use;
    define: (
      ctx: ModuleContext<
        typeof config.actionRegistry,
        DepWorkflows<Use>,
        Context
      >, // ✅ FIXED HERE
    ) => Own;
  }): Module<Reg, Context, Own, Use> {
    return createModule<Reg, Context, Use, Own>(config);
  };
}

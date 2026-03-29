// import { ActionRegistry, Simplify, WorkflowObserver } from "./types.js";
// import { createWorkflow, WorkflowDef } from "./workflow-composer.js";
// import { executeWorkflow } from "./workflow-executor.js";
//
// type AnyWorkflow = WorkflowDef<any, any, any, any, any>;
//
// type WorkflowFromDeps<Deps extends Record<string, any>> = {
//   [K in keyof Deps]: Deps[K] extends Module<any, any, infer Own, infer SubDeps>
//     ? Own[keyof Own] | WorkflowFromDeps<SubDeps>
//     : never;
// }[keyof Deps];
// type ModuleShape = Record<string, AnyWorkflow>;
//
// type ContextFromDeps<Deps> = [keyof Deps] extends [never]
//   ? {} // 👈 THIS is the fix
//   : {
//       [K in keyof Deps]: Deps[K] extends Module<any, infer Ctx, any, any>
//         ? Ctx
//         : never;
//     }[keyof Deps];
//
// type FinalContext<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
//   Deps extends ModuleMap<Reg>,
// > = Context & ContextFromDeps<Deps>;
//
// type ModuleMap<Reg extends ActionRegistry> = Record<
//   string,
//   Module<Reg, any, any, any>
// >;
//
// // type Module<Own extends ModuleShape = {}, Deps extends ModuleMap = {}> = Own & {
// //   deps: Deps;
// // };
// export type WorkflowInput<W> =
//   W extends WorkflowDef<any, infer I, any, any, any> ? I : never;
//
// export type WorkflowResults<W> =
//   W extends WorkflowDef<any, any, infer R, any, any> ? R : never;
//
// export type WorkflowOutput<W> =
//   W extends WorkflowDef<any, any, any, any, infer O> ? O : never;
// type Module<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
//   Own extends ModuleShape = {},
//   Deps extends ModuleMap<Reg> = {},
// > = {
//   own: Own;
//   deps: Deps;
//   createRuntime: (config: {
//     registry: Reg;
//     context: FinalContext<Reg, Context, Deps>;
//   }) => {
//     run: <W extends Own[keyof Own] | WorkflowFromDeps<Deps>>(
//       workflow: W,
//       input: WorkflowInput<W>,
//       obververs?: WorkflowObserver<Reg>[],
//     ) => Promise<{
//       results: WorkflowResults<W>;
//       output: WorkflowOutput<W>;
//       extras: Record<string, any>;
//     }>;
//     getContext: () => FinalContext<Reg, Context, Deps>;
//   };
// };
//
// export type ModuleContext<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
//   Deps extends ModuleMap<Reg>,
// > = {
//   wf: ReturnType<typeof createWorkflow<Reg, Context>>;
//
//   deps: Deps;
//   context: Context;
//
//   tools: <T>(
//     factory: (ctx: {
//       wf: ModuleContext<Reg, Context, Deps>["wf"];
//       deps: Deps;
//       context: Context;
//     }) => T,
//   ) => T;
// };
//
// function createModule<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
//   Use extends ModuleMap<Reg>,
//   Own extends ModuleShape,
// >(config: {
//   use?: Use;
//   define: (ctx: ModuleContext<Reg, Context, Use>) => Own;
// }): Module<Reg, Context, Own, Use> {
//   const wf = createWorkflow<Reg, Context>();
//
//   const deps = (config.use ?? {}) as Use;
//
//   const moduleCtx: ModuleContext<Reg, Context, Use> = {
//     wf,
//     deps,
//     context: {} as Context,
//
//     tools: (factory) =>
//       factory({
//         wf,
//         deps,
//         context: {} as Context,
//       }),
//   };
//
//   const own = config.define(moduleCtx);
//
//   return {
//     own,
//     deps,
//     createRuntime({ registry, context }) {
//       const runtimeCtx = { ...context } as FinalContext<Reg, Context, Use>;
//       return {
//         run: async (workflow, input, observers = []) => {
//           return executeWorkflow(workflow, registry, input, context, observers);
//         },
//         getContext: () => ({ ...runtimeCtx }),
//       };
//     },
//   };
// }
//
// export function createModuleFactory<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
// >() {
//   return function <
//     Use extends ModuleMap<Reg> = {},
//     Own extends ModuleShape = {},
//   >(config: {
//     use?: Use;
//     define: (ctx: ModuleContext<Reg, Context, Use>) => Own;
//   }): Module<Reg, Context, Own, Use> {
//     return createModule<Reg, Context, Use, Own>(config);
//   };
// }
//

////////////////////////////////////// with sub deps infef

// import { ActionRegistry, WorkflowObserver } from "./types.js";
// import { createWorkflow, WorkflowDef } from "./workflow-composer.js";
// import { executeWorkflow } from "./workflow-executor.js";
//
// /* ------------------------------------------------ */
// /* WORKFLOW REGISTRY TYPES                          */
// /* ------------------------------------------------ */
//
// type ModuleWFRegistry<
//   Own extends ModuleShape,
//   Deps extends ModuleMap,
// > = OwnWFs<Own> & (DepsWFs<Deps> extends never ? {} : DepsWFs<Deps>);
//
// type OwnWFs<Own extends ModuleShape> = {
//   [K in keyof Own & string]: Own[K];
// };
//
// type NamespacedDepWFs<
//   DepName extends string,
//   M extends Module<any, any, any, any>,
// > = {
//   [K in keyof M["own"] & string as `${DepName}.${K}`]: M["own"][K];
// };
//
// type DepsWFs<Deps extends ModuleMap> = [keyof Deps] extends [never]
//   ? {}
//   : {
//       [DepName in keyof Deps & string]: NamespacedDepWFs<
//         DepName,
//         Deps[DepName]
//       >;
//     }[keyof Deps & string];
//
// type DepsWFRegistry<Deps extends ModuleMap> =
//   DepsWFs<Deps> extends never ? {} : DepsWFs<Deps>;
//
// /* ------------------------------------------------ */
// /* MODULE TYPES                                     */
// /* ------------------------------------------------ */
//
// type AnyWorkflow = WorkflowDef<any, any, any, any, any>;
// type ModuleShape = Record<string, AnyWorkflow>;
// type ModuleMap = Record<string, Module<any, any, any, any>>;
//
// type ModuleDepsPublic<Use> = {
//   [K in keyof Use]: Use[K] extends Module<any, infer Ctx, infer Own, any>
//     ? ModulePublic<Ctx, Own>
//     : never;
// };
//
// type ModulePublic<
//   Context extends Record<string, any>,
//   Own extends ModuleShape,
// > = {
//   own: Own;
//   __ctx: Context;
// };
//
// type ContextFromDeps<Deps> = [keyof Deps] extends [never]
//   ? {}
//   : {
//       [K in keyof Deps]: Deps[K] extends Module<any, infer Ctx, any, any>
//         ? Ctx
//         : never;
//     }[keyof Deps];
//
// type FinalContext<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
//   Deps extends ModuleMap,
// > = Context & ContextFromDeps<Deps>;
//
// /* ------------------------------------------------ */
// /* WORKFLOW IO TYPES                                */
// /* ------------------------------------------------ */
//
// export type WorkflowInput<W> =
//   W extends WorkflowDef<any, infer I, any, any, any> ? I : never;
//
// export type WorkflowResults<W> =
//   W extends WorkflowDef<any, any, infer R, any, any> ? R : never;
//
// export type WorkflowOutput<W> =
//   W extends WorkflowDef<any, any, any, any, infer O> ? O : never;
//
// /* ------------------------------------------------ */
// /* MODULE RUNTIME                                   */
// /* ------------------------------------------------ */
//
// type Module<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
//   Own extends ModuleShape = {},
//   Deps extends ModuleMap = {},
// > = {
//   own: Own;
//   deps: ModuleDepsPublic<Deps>;
//
//   createRuntime: (config: {
//     registry: Reg;
//     context: FinalContext<Reg, Context, Deps>;
//   }) => {
//     run: <K extends keyof ModuleWFRegistry<Own, Deps>>(
//       workflow: K,
//       input: WorkflowInput<ModuleWFRegistry<Own, Deps>[K]>,
//       observers?: WorkflowObserver<Reg>[],
//     ) => Promise<{
//       results: WorkflowResults<ModuleWFRegistry<Own, Deps>[K]>;
//       output: WorkflowOutput<ModuleWFRegistry<Own, Deps>[K]>;
//       extras: Record<string, any>;
//     }>;
//
//     getContext: () => FinalContext<Reg, Context, Deps>;
//   };
// };
//
// /* ------------------------------------------------ */
// /* MODULE CONTEXT (FIXED)                           */
// /* ------------------------------------------------ */
//
// export type ModuleContext<
//   Reg extends ActionRegistry,
//   WFReg extends Record<string, WorkflowDef<any, any, any, any, any>>,
//   Context extends Record<string, any>,
// > = {
//   wf: ReturnType<typeof createWorkflow<Reg, WFReg, Context>>;
//   context: Context;
// };
//
// /* ------------------------------------------------ */
// /* INTERNAL HELPERS                                 */
// /* ------------------------------------------------ */
//
// function toPublicDeps<Use extends ModuleMap>(deps: Use): ModuleDepsPublic<Use> {
//   return deps as unknown as ModuleDepsPublic<Use>;
// }
//
// /* ------------------------------------------------ */
// /* CREATE MODULE (FIXED)                            */
// /* ------------------------------------------------ */
//
// function createModule<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
//   Use extends ModuleMap,
//   Own extends ModuleShape,
// >(config: {
//   use?: Use;
//   define: (
//     ctx: ModuleContext<Reg, DepsWFRegistry<Use>, Context>, // ✅ FIXED HERE
//   ) => Own;
// }): Module<Reg, Context, Own, Use> {
//   const deps = (config.use ?? {}) as Use;
//
//   // ✅ CRITICAL: wf only sees DEP workflows
//   const wf = createWorkflow<Reg, DepsWFRegistry<Use>, Context>();
//
//   const own = config.define({
//     wf,
//     context: {} as Context,
//   });
//
//   function mergeWFs(): ModuleWFRegistry<Own, Use> {
//     const depWFs = Object.fromEntries(
//       Object.entries(deps).flatMap(([depName, depModule]) =>
//         Object.entries(depModule.own).map(([k, wf]) => [`${depName}.${k}`, wf]),
//       ),
//     );
//
//     return { ...own, ...depWFs } as ModuleWFRegistry<Own, Use>;
//   }
//
//   return {
//     own,
//     deps: toPublicDeps(deps),
//
//     createRuntime({ registry, context }) {
//       const workflowRegistry = mergeWFs();
//
//       return {
//         run: async <K extends keyof ModuleWFRegistry<Own, Use>>(
//           workflowId: K,
//           input: WorkflowInput<ModuleWFRegistry<Own, Use>[K]>,
//           observers: WorkflowObserver<Reg>[] = [],
//         ) => {
//           return executeWorkflow(
//             workflowId,
//             workflowRegistry,
//             registry,
//             input,
//             context,
//             observers,
//           );
//         },
//
//         getContext: () => ({ ...context }) as FinalContext<Reg, Context, Use>,
//       };
//     },
//   };
// }
//
// /* ------------------------------------------------ */
// /* FACTORY (FIXED)                                  */
// /* ------------------------------------------------ */
//
// export function createModuleFactory<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
// >() {
//   return function <
//     Use extends ModuleMap = {},
//     Own extends ModuleShape = {},
//   >(config: {
//     use?: Use;
//     define: (
//       ctx: ModuleContext<Reg, DepsWFRegistry<Use>, Context>, // ✅ FIXED HERE
//     ) => Own;
//   }): Module<Reg, Context, Own, Use> {
//     return createModule<Reg, Context, Use, Own>(config);
//   };
// }

import { ActionRegistry, WorkflowObserver } from "./types.js";
import { createWorkflow, WorkflowDef } from "./workflow-composer.js";
import { executeWorkflow } from "./workflow-executor.js";

/* ------------------------------------------------ */
/* WORKFLOW REGISTRY TYPES                          */
/* ------------------------------------------------ */
type DepWorkflows<Deps extends ModuleMap> = keyof Deps extends never
  ? {}
  : {
      [D in keyof Deps & string]: {
        [K in keyof Deps[D]["workflows"] &
          string as `${D}.${K}`]: Deps[D]["workflows"][K];
      };
    }[keyof Deps & string];

type WorkflowRegistry<Own extends ModuleShape, Deps extends ModuleMap> = Own &
  DepWorkflows<Deps>;

/* ------------------------------------------------ */
/* MODULE TYPES                                     */
/* ------------------------------------------------ */

type AnyWorkflow = WorkflowDef<any, any, any, any, any>;
type ModuleShape = Record<string, AnyWorkflow>;
type ModuleMap = Record<string, Module<any, any, any, any>>;

type ContextFromDeps<Deps> = [keyof Deps] extends [never]
  ? {}
  : {
      [K in keyof Deps]: Deps[K] extends Module<any, infer Ctx, any, any>
        ? Ctx
        : never;
    }[keyof Deps];

type FinalContext<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Deps extends ModuleMap,
> = Context & ContextFromDeps<Deps>;

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
  // deps: ModuleDepsPublic<Deps>;

  createRuntime: (config: {
    registry: Reg;
    context: FinalContext<Reg, Context, Deps>;
  }) => {
    run: <K extends keyof WorkflowRegistry<Own, Deps>>(
      workflow: K,
      input: WorkflowInput<WorkflowRegistry<Own, Deps>[K]>,
      observers?: WorkflowObserver<Reg>[],
    ) => Promise<{
      // results: WorkflowResults<WorkflowRegistry<Own, Deps>[K]>;
      output: WorkflowOutput<WorkflowRegistry<Own, Deps>[K]>;
      extras: Record<string, any>;
    }>;

    getContext: () => FinalContext<Reg, Context, Deps>;
  };
};

/* ------------------------------------------------ */
/* MODULE CONTEXT (FIXED)                           */
/* ------------------------------------------------ */

export type ModuleContext<
  Reg extends ActionRegistry,
  WFReg extends Record<string, WorkflowDef<any, any, any, any, any>>,
  Context extends Record<string, any>,
> = {
  wf: ReturnType<typeof createWorkflow<Reg, WFReg, Context>>;
  context: Context;
};

/* ------------------------------------------------ */
/* CREATE MODULE (FIXED)                            */
/* ------------------------------------------------ */

function createModule<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Use extends ModuleMap,
  Own extends ModuleShape,
>(config: {
  use?: Use;
  define: (
    ctx: ModuleContext<Reg, DepWorkflows<Use>, Context>, // ✅ FIXED HERE
  ) => Own;
}): Module<Reg, Context, Own, Use> {
  const deps = (config.use ?? {}) as Use;

  // ✅ CRITICAL: wf only sees DEP workflows
  const wf = createWorkflow<Reg, DepWorkflows<Use>, Context>();

  const own = config.define({
    wf,
    context: {} as Context,
  });

  function buildRegistry(): WorkflowRegistry<Own, Use> {
    const depWFs = Object.fromEntries(
      Object.entries(deps).flatMap(([name, mod]) =>
        Object.entries(mod.workflows).map(([k, wf]) => [`${name}.${k}`, wf]),
      ),
    );

    return { ...own, ...depWFs } as WorkflowRegistry<Own, Use>;
  }

  return {
    workflows: own,

    createRuntime({ registry, context }) {
      const workflowRegistry = buildRegistry();

      return {
        run: async <K extends keyof WorkflowRegistry<Own, Use>>(
          workflowId: K,
          input: WorkflowInput<WorkflowRegistry<Own, Use>[K]>,
          observers: WorkflowObserver<Reg>[] = [],
        ) => {
          return executeWorkflow(
            workflowId,
            workflowRegistry,
            registry,
            input,
            context,
            observers,
          );
        },

        getContext: () => ({ ...context }) as FinalContext<Reg, Context, Use>,
      };
    },
  };
}

/* ------------------------------------------------ */
/* FACTORY (FIXED)                                  */
/* ------------------------------------------------ */

export function createModuleFactory<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
>() {
  return function <
    Use extends ModuleMap = {},
    Own extends ModuleShape = {},
  >(config: {
    use?: Use;
    define: (
      ctx: ModuleContext<Reg, DepWorkflows<Use>, Context>, // ✅ FIXED HERE
    ) => Own;
  }): Module<Reg, Context, Own, Use> {
    return createModule<Reg, Context, Use, Own>(config);
  };
}

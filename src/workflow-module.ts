// import {
//   ActionRegistry,
//   ServiceRegistry,
//   Executor,
//   Simplify,
//   WorkflowObserver,
// } from "./types.js";
// import {
//   createWorkflow,
//   StepDef,
//   WorkflowBuilder,
//   WorkflowDef,
// } from "./workflow-composer.js";
// import { executeWorkflow } from "./workflow-executor.js";
// type UnionToIntersection<U> = (U extends any ? (x: U) => any : never) extends (
//   x: infer I,
// ) => any
//   ? I
//   : never;
// /* ------------------------------------------------ */
// /* WORKFLOW REGISTRY TYPES                          */
// /* ------------------------------------------------ */
//
// type EnsureWorkflowShape<T> = {
//   [K in keyof T]: T[K] extends WorkflowDef<any, any, any, any, any>
//     ? T[K]
//     : never;
// };
//
// type DepWorkflows<Deps extends ModuleMap> = keyof Deps extends never
//   ? {}
//   : Simplify<
//       EnsureWorkflowShape<
//         UnionToIntersection<
//           {
//             [D in keyof Deps & string]: {
//               [K in keyof Deps[D]["workflows"] &
//                 string as `${D}.${K}`]: Deps[D]["workflows"][K];
//             };
//           }[keyof Deps & string]
//         >
//       >
//     >;
//
// type WorkflowRegistry<Own extends ModuleShape, Deps extends ModuleMap> = Own &
//   DepWorkflows<Deps>;
//
// /* ------------------------------------------------ */
// /* MODULE TYPES                                     */
// /* ------------------------------------------------ */
//
// type AnyWorkflow = WorkflowDef<any, any, any, any, any>;
// type ModuleShape = Record<string, AnyWorkflow>;
// type ModuleMap = Record<string, Module<any, any, any, any>>;
//
// type FinalServices<S extends ServiceRegistry, Deps extends ModuleMap> = S &
//   ServicesFromDepsRecursive<Deps>;
//
// type ServicesFromDepsRecursive<Deps extends ModuleMap> = [keyof Deps] extends [
//   never,
// ]
//   ? {} // no deps
//   : UnionToIntersection<
//       {
//         [K in keyof Deps]: Deps[K] extends Module<
//           any,
//           infer S,
//           any,
//           infer SubDeps
//         >
//           ? S & ServicesFromDepsRecursive<SubDeps>
//           : never;
//       }[keyof Deps]
//     >;
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
// export type Module<
//   Reg extends ActionRegistry,
//   S extends ServiceRegistry,
//   Own extends ModuleShape,
//   Deps extends ModuleMap,
//   Public extends ModuleShape = Own,
// > = {
//   workflows: Own;
//   __getExecutor: () => Executor;
//
//   createRuntime: (config: { services: FinalServices<S, Deps> }) => {
//     run: <K extends keyof Public>(
//       // run: <K extends keyof WorkflowRegistry<Own, Deps>>(
//       workflow: K,
//       input: WorkflowInput<Public[K]>,
//       observers?: WorkflowObserver<Reg>[],
//     ) => Promise<{
//       // results: WorkflowResults<WorkflowRegistry<Own, Deps>[K]>;
//       output: WorkflowOutput<Public[K]>;
//       extras: Record<string, any>;
//     }>;
//
//     getServices: () => FinalServices<S, Deps>;
//   };
// };
//
// /* ------------------------------------------------ */
// /* MODULE CONTEXT (FIXED)                           */
// /* ------------------------------------------------ */
//
// type ModuleContext<
//   Reg extends ActionRegistry,
//   WFReg extends Record<string, WorkflowDef<any, any, any, any, any>>,
//   S extends ServiceRegistry,
// > = {
//   wf: ReturnType<typeof createWorkflow<Reg, WFReg, S>>;
//   services: S;
// };
//
// type ExposedWorkflows<
//   Own extends ModuleShape,
//   Use extends ModuleMap,
//   Expose extends Record<string, keyof DepWorkflows<Use>> | undefined,
// > = Own &
//   (Expose extends Record<string, keyof DepWorkflows<Use>>
//     ? {
//         [K in keyof Expose]: DepWorkflows<Use>[Expose[K]];
//       }
//     : {});
// function createModule<
//   Reg extends ActionRegistry,
//   S extends ServiceRegistry,
//   Use extends ModuleMap,
//   Own extends ModuleShape,
//   Expose extends Record<string, keyof DepWorkflows<Use>> | undefined,
// >(config: {
//   actionRegistry: Reg;
//   use?: Use;
//   expose?: Expose;
//   define: (ctx: ModuleContext<Reg, DepWorkflows<Use>, S>) => Own;
// }): Module<Reg, S, Own, Use, ExposedWorkflows<Own, Use, Expose>> {
//   const deps = (config.use ?? {}) as Use;
//
//   const wf = createWorkflow<Reg, DepWorkflows<Use>, S>();
//
//   const own = config.define({
//     wf,
//     services: {} as S,
//   });
//
//   // function buildWorkflowMap(): WorkflowRegistry<Own, Use> {
//   //   const depWFs = Object.fromEntries(
//   //     Object.entries(deps).flatMap(([name, mod]) =>
//   //       Object.entries(mod.workflows).map(([k, wf]) => [`${name}.${k}`, wf]),
//   //     ),
//   //   );
//   //
//   //   const internal = { ...own, ...depWFs } as WorkflowRegistry<Own, Use>;
//   //
//   //   const publicMap = own;
//   //   return { internal, publicMap };
//   // }
//
//   function buildWorkflowMap() {
//     const depWFs = Object.fromEntries(
//       Object.entries(deps).flatMap(([name, mod]) =>
//         Object.entries(mod.workflows).map(([k, wf]) => [`${name}.${k}`, wf]),
//       ),
//     );
//
//     // const internal = { ...own, ...depWFs } as WorkflowRegistry<Own, Use>;
//
//     // const exposed = Object.fromEntries(
//     //   Object.entries(config.expose ?? {}).map(([alias, key]) => [
//     //     alias,
//     //     internal[key], // reuse already resolved workflow
//     //   ]),
//     // );
//     //
//     const internalBase = { ...own, ...depWFs } as WorkflowRegistry<Own, Use>;
//
//     const exposed = {} as Record<string, AnyWorkflow>;
//
//     if (config.expose) {
//       for (const alias in config.expose) {
//         const key = config.expose[alias];
//         exposed[alias] = internalBase[key];
//       }
//     }
//     const internal = {
//       ...internalBase,
//       ...exposed,
//     } as WorkflowRegistry<Own, Use> & typeof exposed;
//     // if (config.expose) {
//     //   for (const alias in config.expose) {
//     //     const key = config.expose[alias];
//     //     exposed[alias] = internal[key];
//     //   }
//     // }
//
//     const publicMap = { ...own, ...exposed } as ExposedWorkflows<
//       Own,
//       Use,
//       Expose
//     >;
//     return { internal, publicMap };
//   }
//
//   const { internal, publicMap } = buildWorkflowMap();
//
//   const depsExecutors = Object.fromEntries(
//     Object.entries(deps).map(([name, mod]) => [name, mod.__getExecutor()]),
//   );
//
//   const executor: Executor = {
//     run(wfId, input, services, observers = []) {
//       if (!(wfId in publicMap)) {
//         throw new Error(`Workflow not in public: ${wfId}`);
//       }
//
//       const workflow = internal[wfId];
//
//       if (!workflow) {
//         throw new Error(`Workflow not found: ${String(wfId)}`);
//       }
//
//       return executeWorkflow({
//         workflow,
//         actionRegistry: config.actionRegistry,
//         depsExecutors,
//         input,
//         services,
//         observers,
//       });
//     },
//   };
//
//   return {
//     workflows: own,
//     __getExecutor: () => executor,
//
//     createRuntime({ services }) {
//       let runtimeActions = config.actionRegistry;
//
//       // const runtimeService = createServiceRegisty(services)
//       return {
//         run: async <K extends keyof typeof publicMap>(
//           // run: async <K extends keyof WorkflowRegistry<Own, Use>>(
//           workflowId: K,
//           input: WorkflowInput<(typeof publicMap)[K]>,
//           // input: WorkflowInput<WorkflowRegistry<Own, Use>[K]>,
//           // input: WorkflowInput<WorkflowRegistry<Own, Use>[K]>,
//           observers: WorkflowObserver<Reg>[] = [],
//         ) => {
//           return executor.run(workflowId as string, input, services, observers);
//         },
//         // make it same, practically nothing changes but naming, and what context holds
//         getServices: () => ({ ...services }) as FinalServices<S, Use>,
//
//         setActionRegistry(reg: Reg) {
//           runtimeActions = reg;
//           // ⚠️ optional: if you REALLY want override, you'd need:
//           // executor.actions = reg
//           // but better keep actions immutable
//         },
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
//   // Reg extends ActionRegistry,
//   S extends ServiceRegistry,
// >() {
//   return function <
//     Reg extends ActionRegistry = Record<string, any>,
//     Use extends ModuleMap = {},
//     Own extends ModuleShape = {},
//     Expose extends Record<string, keyof DepWorkflows<Use>> | undefined =
//       undefined,
//   >(config: {
//     actionRegistry: Reg;
//     use?: Use;
//     expose?: Expose;
//     define: (
//       ctx: ModuleContext<typeof config.actionRegistry, DepWorkflows<Use>, S>,
//     ) => Own;
//   }): Module<Reg, S, Own, Use, ExposedWorkflows<Own, Use, Expose>> {
//     return createModule<Reg, S, Use, Own, Expose>(config);
//   };
// }
//

import {
  ActionRegistry,
  ServiceRegistry,
  Executor,
  Simplify,
  WorkflowObserver,
} from "./types.js";
import {
  createWorkflow,
  StepDef,
  WorkflowBuilder,
  WorkflowDef,
} from "./workflow-composer.js";
import { executeWorkflow } from "./workflow-executor.js";
type UnionToIntersection<U> = (U extends any ? (x: U) => any : never) extends (
  x: infer I,
) => any
  ? I
  : never;
/* ------------------------------------------------ */
/* WORKFLOW REGISTRY TYPES                          */
/* ------------------------------------------------ */

export type EnsureWorkflowShape<T> = {
  [K in keyof T]: T[K] extends WorkflowDef<any, any, any, any, any>
    ? T[K]
    : never;
};

// type DepWorkflows<Deps extends ModuleMap> = Simplify<
//   keyof Deps extends never
//     ? {}
//     : EnsureWorkflowShape<
//         UnionToIntersection<
//           {
//             [D in keyof Deps & string]: {
//               [K in keyof Deps[D]["__public"] &
//                 string as `${D}.${K}`]: Deps[D]["__public"][K];
//             };
//           }[keyof Deps & string]
//         >
//       >
// >;
export type DepWorkflows<Deps extends ModuleMap> = keyof Deps extends never
  ? {}
  : Simplify<
      EnsureWorkflowShape<
        UnionToIntersection<
          {
            [D in keyof Deps & string]: {
              [K in keyof Deps[D]["__public"] &
                string as `${D}.${K}`]: Deps[D]["__public"][K];
            };
          }[keyof Deps & string]
        >
      >
    >;

export type WorkflowRegistry<
  Own extends ModuleShape,
  Deps extends ModuleMap,
> = Own & DepWorkflows<Deps>;

/* ------------------------------------------------ */
/* MODULE TYPES                                     */
/* ------------------------------------------------ */

export type AnyWorkflow = WorkflowDef<any, any, any, any, any>;
export type ModuleShape = Record<string, AnyWorkflow>;
export type ModuleMap = Record<string, Module<any, any, any, any, any>>;

export type FinalServices<
  S extends ServiceRegistry,
  Deps extends ModuleMap,
> = S & ServicesFromDepsRecursive<Deps>;

export type ServicesFromDepsRecursive<Deps extends ModuleMap> = [
  keyof Deps,
] extends [never]
  ? {} // no deps
  : UnionToIntersection<
      {
        [K in keyof Deps]: Deps[K] extends Module<
          any,
          infer S,
          any,
          infer SubDeps,
          any
        >
          ? S & ServicesFromDepsRecursive<SubDeps>
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

export type Module<
  Reg extends ActionRegistry,
  S extends ServiceRegistry,
  Own extends ModuleShape,
  Deps extends ModuleMap,
  Public extends ModuleShape,
> = {
  workflows: Own;

  __public: Public;
  __getExecutor: () => Executor;

  createRuntime: (config: { services: FinalServices<S, Deps> }) => {
    run: <K extends keyof Public>(
      workflow: K,
      input: WorkflowInput<Public[K]>,
      observers?: WorkflowObserver<Reg>[],
    ) => Promise<{
      output: WorkflowOutput<Public[K]>;
      extras: Record<string, any>;
    }>;

    getServices: () => FinalServices<S, Deps>;
  };
};

/* ------------------------------------------------ */
/* MODULE CONTEXT (FIXED)                           */
/* ------------------------------------------------ */

export type ModuleContext<
  Reg extends ActionRegistry,
  WFReg extends Record<string, WorkflowDef<any, any, any, any, any>>,
  S extends ServiceRegistry,
> = {
  wf: ReturnType<typeof createWorkflow<Reg, WFReg, S>>;
  services: S;
};

export type ExposedWorkflows<
  Own extends ModuleShape,
  Use extends ModuleMap,
  Expose extends Record<string, keyof DepWorkflows<Use>> | undefined,
> = Own &
  (Expose extends Record<string, keyof DepWorkflows<Use>>
    ? {
        [K in keyof Expose]: DepWorkflows<Use>[Expose[K]];
      }
    : {});
function createModule<
  Reg extends ActionRegistry,
  S extends ServiceRegistry,
  Use extends ModuleMap,
  Own extends ModuleShape,
  Expose extends Record<string, keyof DepWorkflows<Use>> | undefined,
>(config: {
  actionRegistry: Reg;
  use?: Use;
  expose?: Expose;
  define: (ctx: ModuleContext<Reg, DepWorkflows<Use>, S>) => Own;
}): Module<Reg, S, Own, Use, ExposedWorkflows<Own, Use, Expose> & ModuleShape> {
  const deps = (config.use ?? {}) as Use;

  type WFReg = DepWorkflows<Use>;

  const wf = createWorkflow<Reg, WFReg, S>();

  const own = config.define({
    wf,
    services: {} as S,
  });

  function buildWorkflowMap() {
    const depWFs = Object.fromEntries(
      Object.entries(deps).flatMap(([name, mod]) =>
        Object.entries(mod.__public).map(([k, wf]) => [`${name}.${k}`, wf]),
      ),
    );

    const internalBase = { ...own, ...depWFs } as WorkflowRegistry<Own, Use>;

    const exposed = {} as Record<string, AnyWorkflow>;

    if (config.expose) {
      for (const alias in config.expose) {
        const key = config.expose[alias];
        exposed[alias] = internalBase[key];
      }
    }
    const internal = {
      ...internalBase,
      ...exposed,
    } as WorkflowRegistry<Own, Use> & typeof exposed;

    const publicMap = { ...own, ...exposed } as ExposedWorkflows<
      Own,
      Use,
      Expose
    >;
    return { internal, publicMap };
  }

  const { internal, publicMap } = buildWorkflowMap();

  const depsExecutors = Object.fromEntries(
    Object.entries(deps).map(([name, mod]) => [name, mod.__getExecutor()]),
  );

  const executor: Executor = {
    run(wfId, input, services, observers = []) {
      if (!(wfId in publicMap)) {
        throw new Error(`Workflow not in public: ${wfId}`);
      }

      const workflow = internal[wfId];

      if (!workflow) {
        throw new Error(`Workflow not found: ${String(wfId)}`);
      }

      return executeWorkflow({
        workflow,
        actionRegistry: config.actionRegistry,
        depsExecutors,
        input,
        services,
        observers,
      });
    },
  };

  return {
    workflows: own,
    __public: publicMap,
    __getExecutor: () => executor,

    createRuntime({ services }) {
      let runtimeActions = config.actionRegistry;

      return {
        run: async <K extends keyof typeof publicMap>(
          workflowId: K,
          input: WorkflowInput<(typeof publicMap)[K]>,

          observers: WorkflowObserver<Reg>[] = [],
        ) => {
          return executor.run(workflowId as string, input, services, observers);
        },

        getServices: () => ({ ...services }) as FinalServices<S, Use>,

        setActionRegistry(reg: Reg) {
          runtimeActions = reg;
        },
      };
    },
  };
}

/* ------------------------------------------------ */
/* FACTORY (FIXED)                                  */
/* ------------------------------------------------ */

export function createModuleFactory<S extends ServiceRegistry>() {
  return function <
    Reg extends ActionRegistry,
    Use extends ModuleMap,
    Own extends ModuleShape,
    Expose extends Record<string, keyof DepWorkflows<Use>> | undefined =
      undefined,
  >(config: {
    actionRegistry: Reg;
    use?: Use;
    expose?: Expose;
    define: (
      ctx: ModuleContext<typeof config.actionRegistry, DepWorkflows<Use>, S>,
    ) => Own;
  }): Module<Reg, S, Own, Use, ExposedWorkflows<Own, Use, Expose>> {
    return createModule<Reg, S, Use, Own, Expose>(config);
  };
}

import { compileModule } from "./ast-compiler.js";
import { executePlan } from "./executor.js";
import { COMPILED_GRAPH, DEPS, EXEC_GRAPH } from "./symbols.js";
import {
  ServiceMetaRegistry,
  ServiceRegistry,
  Simplify,
  WorkflowObserver,
} from "./types.js";

import { createWorkflow, WorkflowDef } from "./workflow-composer.js";

type UnionToIntersection<U> = (U extends any ? (x: U) => any : never) extends (
  x: infer I,
) => any
  ? I
  : never;

export type EnsureWorkflowShape<T> = {
  [K in keyof T]: T[K] extends WorkflowDef<any, any, any> ? T[K] : never;
};

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

export type AnyWorkflow = WorkflowDef<any, any, any, any>;
export type ModuleShape = Record<string, AnyWorkflow>;
export type ModuleMap = Record<string, Module<any, any, any, any>>;

export type FinalServices<
  S extends ServiceRegistry,
  Deps extends ModuleMap,
> = S & ServicesFromDeps<Deps>;

// export type ServicesFromDeps<Deps extends ModuleMap> = UnionToIntersection<
//   {
//     [K in keyof Deps]: Deps[K] extends Module<any, infer S, any, any, any>
//       ? S
//       : never;
//   }[keyof Deps]
// >;
type ExtractServices<M> = M extends Module<infer S, any, any, any> ? S : never;
export type ServicesFromDeps<Deps extends ModuleMap> = {
  [K in keyof Deps]: ExtractServices<Deps[K]>;
}[keyof Deps] extends infer U
  ? UnionToIntersection<U>
  : never;

export type ServicesFromDepsRecursive<Deps extends ModuleMap> = [
  keyof Deps,
] extends [never]
  ? {} // no deps
  : UnionToIntersection<
      {
        [K in keyof Deps]: Deps[K] extends Module<
          infer S,
          any,
          infer SubDeps,
          any
        >
          ? S & ServicesFromDepsRecursive<SubDeps>
          : never;
      }[keyof Deps]
    >;

export type WorkflowInput<W> =
  W extends WorkflowDef<infer I, any, any, any> ? I : never;

export type WorkflowResults<W> =
  W extends WorkflowDef<any, infer R, any, any> ? R : never;

export type WorkflowOutput<W> =
  W extends WorkflowDef<any, any, any, infer O> ? O : never;

export type ModuleContext<
  WFReg extends Record<string, WorkflowDef<any, any, any, any>>,
  S extends ServiceRegistry,
> = {
  wf: ReturnType<typeof createWorkflow<WFReg, S>>;
};
export type ExposedWorkflows<
  Own extends ModuleShape,
  Use extends ModuleMap,
  Expose extends Record<string, keyof DepWorkflows<Use>> | undefined,
> =
  Expose extends Record<string, keyof DepWorkflows<Use>>
    ? Own & {
        [K in keyof Expose]: DepWorkflows<Use>[Expose[K]];
      }
    : Own; // ← When

export type Module<
  S extends ServiceRegistry,
  Own extends ModuleShape,
  Deps extends ModuleMap,
  Public extends ModuleShape,
> = {
  workflows: Own;
  __public: Public;
  [DEPS]: ModuleMap;
  [EXEC_GRAPH]: ModuleShape;
};

function createModule<
  S extends ServiceRegistry,
  Use extends ModuleMap,
  Own extends ModuleShape,
  Expose extends Record<string, keyof DepWorkflows<Use>> | undefined,
>(config: {
  use?: Use;
  expose?: Expose;
  define: (ctx: ModuleContext<DepWorkflows<Use>, S>) => Own;
}): Module<S, Own, Use, ExposedWorkflows<Own, Use, Expose> & ModuleShape> {
  const deps = (config.use ?? {}) as Use;

  type WFReg = DepWorkflows<Use>;

  const depWFs = Object.fromEntries(
    Object.entries(deps).flatMap(([name, mod]) =>
      Object.entries(mod.__public).map(([k, wf]) => [`${name}.${k}`, wf]),
    ),
  );

  const wf = createWorkflow<WFReg, S>(depWFs as any);

  const own = config.define({
    wf,
  });

  function mergePublic<
    Own extends ModuleShape,
    Use extends ModuleMap,
    Expose extends Record<string, keyof DepWorkflows<Use>> | undefined,
  >(
    own: Own,
    exposed: Record<string, AnyWorkflow>,
  ): ExposedWorkflows<Own, Use, Expose> {
    return { ...own, ...exposed } as any;
  }

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

    const publicMap = mergePublic<Own, Use, Expose>(own, exposed);
    return { internal, publicMap };
  }
  const { internal, publicMap } = buildWorkflowMap();

  return {
    workflows: own,
    __public: publicMap,
    [DEPS]: deps,
    [EXEC_GRAPH]: internal,
  } satisfies Module<
    S,
    Own,
    Use,
    ExposedWorkflows<Own, Use, Expose> & ModuleShape
  >;
}

export function createRuntimeRoot<M extends Module<any, any, any, any>>({
  module,
  services,
  meta,
}: {
  module: M;
  services: RuntimeServices<M>;
  meta?: ServiceMetaRegistry<any>;
}) {
  const compiled = compileModule(module, services, meta);

  return {
    run: async <K extends keyof M["__public"]>(
      workflowId: K,
      input: WorkflowInput<M["__public"][K]>,
      observers: WorkflowObserver[] = [],
    ): Promise<{
      output: WorkflowOutput<M["__public"][K]>;
      extras: Record<string, any>;
    }> => {
      const plan = compiled[COMPILED_GRAPH][workflowId as string];

      if (!plan) {
        throw new Error(`Workflow not found: ${String(workflowId)}`);
      }

      // const results = new Array(plan.maxIdx + 1);

      const output = await executePlan(plan, input, observers);

      return {
        output,
        extras: {},
      };
    },
  };
}

type ModuleServices<M> = M extends Module<infer S, any, any, any> ? S : never;

type ModuleDeps<M> = M extends Module<any, any, infer D, any> ? D : never;

type RuntimeServices<M extends Module<any, any, any, any>> = FinalServices<
  ModuleServices<M>,
  ModuleDeps<M>
>;

export function createModuleFactory<S extends ServiceRegistry>() {
  return function <
    Use extends ModuleMap = {},
    Own extends ModuleShape = {},
    Expose extends Record<string, keyof DepWorkflows<Use>> = {},
  >(config: {
    use?: Use;
    expose?: Expose;
    define: (ctx: ModuleContext<DepWorkflows<Use>, S>) => Own;
  }): Module<S, Own, Use, ExposedWorkflows<Own, Use, Expose>> {
    return createModule<S, Use, Own, Expose>(config);
  };
}

import { compileModule, compileWorkflow } from "./ast-compiler.js";
import { createExecutor } from "./executor.js";
import { COMPILED_GRAPH, DEPS, MODULE_ID, UNSET } from "./symbols.js";
import {
  ExecutionPlan,
  Module,
  ModuleContext,
  RuntimeOptions,
  RuntimeServices,
  ServiceMetaRegistry,
  ServiceRegistry,
  WorkflowInput,
  WorkflowOutput,
} from "./types.js";

import { createWorkflow, WorkflowDef } from "./workflow-composer.js";

type Merge<A, B> = A & B;

function createModule<
  S extends ServiceRegistry,
  Use extends Record<string, Module<any, any>>,
  Own extends Record<string, WorkflowDef<any, any, any, any>>,
  Expose extends Record<string, WorkflowDef<any, any, any, any>> = {},
>(config: {
  use?: Use;
  expose?: Expose;

  define: (ctx: ModuleContext<Use, S>) => Own;
}): Module<S, Own & Expose> {
  const deps = config.use ?? ({} as Use);

  const wf = createWorkflow<S>();

  const own = config.define({
    wf,
    deps,
  });

  const module = Object.create(own);

  if (config.expose) {
    for (const k in config.expose) {
      Object.defineProperty(module, k, {
        value: config.expose[k],
        enumerable: true,
      });
    }
  }
  return module as Module<S, Own & Expose>;

  // return {
  //   ...own,
  //   ...(config.expose ?? {}),
  // } as Merge<Own, Expose>;
}

export function createModuleFactory<S extends ServiceRegistry>() {
  return function <
    Use extends Record<string, Module<any, any>> = {},
    Own extends Record<string, WorkflowDef<any, any, any, any>> = {},
    Expose extends Record<string, WorkflowDef<any, any, any, any>> = {},
  >(config: {
    use?: Use;
    expose?: Expose;

    define: (ctx: ModuleContext<Use, S>) => Own;
  }): Module<S, Own & Expose> {
    return createModule<S, Use, Own, Expose>(config);
  };
}

export function createRuntimeRoot<MM extends Record<string, Module<any, any>>>({
  modules,
  services,
  meta,
  options,
}: {
  modules: MM;
  services: RuntimeServices<MM>;
  meta?: ServiceMetaRegistry<any>;
  options?: RuntimeOptions<MM>;
}) {
  const compiledCache: Map<string, ExecutionPlan> = new Map();
  console.log("cache bef", compiledCache);
  return {
    run: async <M extends keyof MM & string, K extends keyof MM[M] & string>(
      modKey: M,
      workflow: K,
      input: WorkflowInput<MM[M][K]>,
    ): Promise<{
      output: WorkflowOutput<MM[M][K]>;
      extras: Record<string, unknown>;
    }> => {
      const modId = modules[modKey][workflow].__id;

      if (!compiledCache.has(modId)) {
        compiledCache.set(
          modId,
          compileWorkflow(modules[modKey][workflow], { meta }),
        );
      }

      const plan = compiledCache.get(modId);

      if (!plan) {
        throw new Error(`Compiled plan not found`);
      } else {
        const executor = createExecutor(
          plan,
          services as any,
          options?.global?.observers ?? [],
        );

        const results = new Array(plan.maxIndex + 1);

        if (typeof plan.initIdx === "number") {
          results[plan.initIdx] = input;
        }

        const output = await executor(results, {});
        console.dir(compiledCache, { depth: 16 });
        return {
          output,
          extras: {},
        };
      }
    },
  };

  // return {
  //   run: async <K extends keyof M["__public"]>(
  //     workflowId: K,
  //     input: WorkflowInput<M["__public"][K]>,
  //     observers: WorkflowObserver[] = [],
  //   ): Promise<{
  //     output: WorkflowOutput<M["__public"][K]>;
  //     extras: Record<string, any>;
  //   }> => {
  //     const plan = compiled[COMPILED_GRAPH][workflowId as string];
  //
  //     if (!plan) {
  //       throw new Error(`Workflow not found: ${String(workflowId)}`);
  //     }
  //
  //     const executor = createExecutor(plan, services, observers);
  //
  //     const results = new Array(plan.maxIndex + 1);
  //     // results.fill(UNSET);
  //
  //     if (typeof plan.initIdx === "number") {
  //       results[plan.initIdx] = input;
  //     }
  //
  //     const output = await executor(results, {});
  //     // const output = await executePlan(plan, input, results, observers);
  //
  //     return {
  //       output,
  //       extras: {},
  //     };
  //   },
  // };
}

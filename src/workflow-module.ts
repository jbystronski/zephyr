import { compileModule, compileWorkflow } from "./ast-compiler.js";
import { createExecutor } from "./executor.js";
import { COMPILED_GRAPH, DEPS, MODULE_ID, UNSET } from "./symbols.js";
import {
  ExecutionPlan,
  Module,
  Runtime,
  RuntimeOptions,
  RuntimeServices,
  ServiceMetaRegistry,
  ServiceRegistry,
  WorkflowInput,
  WorkflowOutput,
} from "./types.js";

import { createWorkflow, WorkflowDef } from "./workflow-composer.js";

export function createModule<S extends ServiceRegistry>() {
  const wf = createWorkflow<S>();

  return function <WFs extends Record<string, WorkflowDef<any, any>>>(
    define: (ctx: { wf: ReturnType<typeof createWorkflow<S>> }) => WFs,
  ): Module<S, WFs> {
    return define({ wf }) as Module<S, WFs>;
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
}): Runtime<MM> {
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

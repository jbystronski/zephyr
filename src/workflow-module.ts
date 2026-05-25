import { compileModule, compileWorkflow } from "./ast-compiler.js";
import { createExecutor } from "./executor.js";
import { COMPILED_GRAPH, DEPS, MODULE_ID, UNSET } from "./symbols.js";
import {
  ExecutionPlan,
  Module,
  Runtime,
  RuntimeOptions,
  ServiceMetaRegistry,
  ServiceRegistry,
  WorkflowInput,
  WorkflowOutput,
} from "./types.js";

import { createWorkflow, WorkflowDef } from "./workflow-composer.js";

// export function createModule<S extends ServiceRegistry>() {
//   const wf = createWorkflow<S>();
//
//   return function <WFs extends Record<string, WorkflowDef<any, any>>>(
//     define: (ctx: { wf: ReturnType<typeof createWorkflow<S>> }) => WFs,
//   ): Module<S, WFs> {
//     const workflows = define({ wf }) as Module<S, WFs>;
//
//     return Object.assign(workflows, {
//       _services: null as unknown as S,
//     }) as Module<S, WFs>;
//   };
// }
//

export function createModule<S extends ServiceRegistry>() {
  const wf = createWorkflow<S>();

  return function <WFs extends Record<string, WorkflowDef<any, any>>>(
    define: (ctx: { wf: ReturnType<typeof createWorkflow<S>> }) => WFs,
  ): Module<S, WFs> {
    return define({ wf }) as Module<S, WFs>;
  };
}

// export function createRuntimeRoot<
//   MM extends Record<string, Module<any, any>>,
//   S extends ServiceRegistry,
// >({
//   modules,
//   services,
//   meta,
//   options,
// }: {
//   modules: MM;
//   // services: RuntimeServices<MM>;
//   services: S;
//   meta?: ServiceMetaRegistry<any>;
//   options?: RuntimeOptions<MM>;
// }): Runtime<MM> {
//   const compiledCache: Map<string, ExecutionPlan> = new Map();
//   console.log("cache bef", compiledCache);
//   return {
//     run: async <M extends keyof MM & string, K extends keyof MM[M] & string>(
//       modKey: M,
//       workflow: K,
//       input: WorkflowInput<MM[M][K]>,
//     ): Promise<{
//       output: WorkflowOutput<MM[M][K]>;
//       extras: Record<string, unknown>;
//     }> => {
//       const modId = modules[modKey][workflow].__id;
//
//       if (!compiledCache.has(modId)) {
//         compiledCache.set(
//           modId,
//           compileWorkflow(modules[modKey][workflow], { meta }),
//         );
//       }
//
//       const plan = compiledCache.get(modId);
//
//       if (!plan) {
//         throw new Error(`Compiled plan not found`);
//       } else {
//         const executor = createExecutor(
//           plan,
//           services as any,
//           options?.global?.observers ?? [],
//         );
//
//         const results = new Array(plan.maxIndex + 1);
//
//         if (typeof plan.initIdx === "number") {
//           results[plan.initIdx] = input;
//         }
//
//         const output = await executor(results, {});
//         console.dir(compiledCache, { depth: 16 });
//         return {
//           output,
//           extras: {},
//         };
//       }
//     },
//   };
type RuntimeBuilder<S, MM extends Record<string, Module<any, any>>> = {
  addMod<K extends string, M extends Module<any, any>>(
    key: K,
    module: M,
  ): RuntimeBuilder<S, MM & Record<K, M>>;

  build(): Runtime<MM>;
};

// type RequiredServices<M> = M extends Module<infer R, any> ? R : never;
//
// type StripIndex<T> = {
//   [K in keyof T as string extends K ? never : K]: T[K];
// };
//
// Check if module's services are satisfied by runtime's services

export function createRuntimeRoot<
  S extends ServiceRegistry,
  MM extends Record<string, Module<any, any>> = {},
>(
  services: S,
  meta?: ServiceMetaRegistry<any>,
  options?: RuntimeOptions<MM>,
): RuntimeBuilder<S, MM> {
  const moduleMap = {} as MM;

  const compiledCache: Map<string, ExecutionPlan> = new Map();

  return {
    addMod<K extends string, M extends Module<any, any>>(key: K, module: M) {
      moduleMap[key as keyof MM] = module as any;

      return this as RuntimeBuilder<S, MM & Record<K, M>>;
    },

    build: () => {
      return {
        run: async <
          M extends keyof MM & string,
          K extends keyof MM[M] & string,
        >(
          modKey: M,
          workflow: K,
          input: WorkflowInput<MM[M][K]>,
        ): Promise<{
          output: WorkflowOutput<MM[M][K]>;
          extras: Record<string, unknown>;
        }> => {
          const modId = moduleMap[modKey][workflow].__id;

          if (!compiledCache.has(modId)) {
            compiledCache.set(
              modId,
              compileWorkflow(moduleMap[modKey][workflow], { meta }),
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

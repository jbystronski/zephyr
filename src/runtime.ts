import { compileWorkflow } from "./ast-compiler.js";
import { createExecutor } from "./executor.js";
import {
  ExecutionPlan,
  Module,
  Runtime,
  RuntimeOptions,
  ServiceMetaRegistry,
  WorkflowInput,
} from "./types.js";

type RuntimeBuilder<S, MM extends Record<string, Module<any, any>>> = {
  addMod<K extends string, M extends Module<any, any>>(
    key: K,
    module: M,
  ): RuntimeBuilder<S, MM & Record<K, M>>;

  build(): Runtime<MM>;
};

// export function createRuntime<
//   S,
//   MM extends Record<string, Module<any, any>> = {},
// >(services: S, meta?: ServiceMetaRegistry<any>, options?: RuntimeOptions<MM>) {
//   let moduleMap = {} as MM;
//   const compiledCache = new Map<string, ExecutionPlan>();
//
//   const builder = {
//     addMod<K extends string, M extends Module<any, any>>(key: K, module: M) {
//       (moduleMap as any)[key] = module;
//
//       return this as RuntimeBuilder<S, MM & Record<K, M>>;
//     },
//     build() {
//       return {
//         run: async <
//           M extends keyof typeof moduleMap & string,
//           K extends keyof (typeof moduleMap)[M] & string,
//         >(
//           modKey: M,
//           workflow: K,
//           input: WorkflowInput<(typeof moduleMap)[M][K]>,
//         ) => {
//           const modId = moduleMap[modKey][workflow].__id;
//           if (!compiledCache.has(modId)) {
//             compiledCache.set(
//               modId,
//               compileWorkflow(moduleMap[modKey][workflow], { meta }),
//             );
//           }
//
//           const plan = compiledCache.get(modId);
//
//           if (!plan) {
//             throw new Error(`Compiled plan not found`);
//           } else {
//             const executor = createExecutor(
//               plan,
//               services as any,
//               options?.global?.observers ?? [],
//             );
//
//             const results = new Array(plan.maxIndex + 1);
//
//             if (typeof plan.initIdx === "number") {
//               results[plan.initIdx] = input;
//             }
//
//             const output = await executor(results, {});
//             console.dir(compiledCache, { depth: 16 });
//             return {
//               output,
//               extras: {},
//             };
//           }
//         },
//       };
//     },
//   };
//
//   return builder;
// }

function makeBuilder<S, MM extends Record<string, Module<any, any>>>(
  services: S,
  moduleMap: MM,
  compiledCache: Map<string, ExecutionPlan>,
  meta?: ServiceMetaRegistry<any>,
  options?: RuntimeOptions<MM>,
): RuntimeBuilder<S, MM> {
  return {
    addMod<K extends string, M extends Module<any, any>>(key: K, module: M) {
      const nextModules = {
        ...moduleMap,
        [key]: module,
      } as MM & Record<K, M>;

      return makeBuilder(services, nextModules, compiledCache, meta, options);
    },

    build() {
      return {
        run: async <
          M extends keyof MM & string,
          K extends keyof MM[M] & string,
        >(
          modKey: M,
          workflow: K,
          input: WorkflowInput<MM[M][K]>,
        ) => {
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
          }

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

          return {
            output,
            extras: {},
          };
        },
      };
    },
  };
}
export function createRuntime<S>(
  services: S,
  meta?: ServiceMetaRegistry<any>,
  options?: RuntimeOptions<any>,
) {
  return makeBuilder<S, {}>(
    services,
    {},
    new Map<string, ExecutionPlan>(),
    meta,
    options,
  );
}

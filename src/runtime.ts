import { compileWorkflow } from "./ast-compiler.js";
import { createExecutor } from "./executor.js";
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

export function createRuntime<
  S extends ServiceRegistry,
  MM extends Record<string, Module<any, any>>,
>({
  modules,
  services,
  meta,
  options,
}: {
  modules: MM;

  services: S;
  meta?: ServiceMetaRegistry<any>;
  options?: RuntimeOptions<MM>;
}): Runtime<MM> {
  const compiledCache: Map<string, ExecutionPlan> = new Map();

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
}

export type Expand<T> = {
  [K in keyof T]: T[K];
} & {};

export type Merge<A, B> = Expand<A & B>;

export type RuntimeBuilder<S, MM extends Record<string, Module<any, any>>> = {
  addMod<K extends string, M extends Module<any, any>>(
    key: K,
    module: M,
  ): RuntimeBuilder<S, MM & Record<K, M>>;

  build(): Runtime<MM>;
};

export function createRuntimeBuilder<S>(
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
      } as Merge<MM, Record<K, M>>;

      return makeBuilder<S, Merge<MM, Record<K, M>>>(
        services,
        nextModules,
        compiledCache,
        meta,
        options,
      );
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

import { compileWorkflow } from "./ast-compiler.js";
import { createExecutor } from "./executor.js";
import {
  ExecutionPlan,
  Module,
  RuntimeOptions,
  ServiceMetaRegistry,
  ServiceRegistry,
  WorkflowDef,
  WorkflowInput,
  WorkflowOutput,
} from "./types.js";

export function createRuntime<S extends ServiceRegistry>({
  precompileModules,
  precompileWorkflows,
  services,
  meta,
  options,
}: {
  precompileModules?: Module<any, any>[];
  precompileWorkflows?: WorkflowDef<any, any>[];
  services: S;
  meta?: ServiceMetaRegistry<any>;
  options?: RuntimeOptions;
}) {
  const compiledCache: Map<string, ExecutionPlan> = new Map();

  const precompile = (wfs?: WorkflowDef<any, any>[]) => {
    if (wfs?.length) {
      for (const wf of wfs ?? []) {
        if (!compiledCache.has(wf.__id)) {
          compiledCache.set(wf.__id, compileWorkflow(wf, { meta }));
        }
      }
    }
  };

  precompile(precompileWorkflows);

  if (precompileModules?.length) {
    const wfs = precompileModules.flatMap((m) =>
      Object.values(m),
    ) as WorkflowDef<any, any>[];
    precompile(wfs);
  }

  return {
    run: async <WF extends WorkflowDef<any, any>>(
      wf: WF,
      input: WorkflowInput<WF>,
    ): Promise<{
      output: WorkflowOutput<WF>;
      extras: Record<string, unknown>;
    }> => {
      if (!compiledCache.has(wf.__id)) {
        compiledCache.set(wf.__id, compileWorkflow(wf, { meta }));
      }

      const plan = compiledCache.get(wf.__id);

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

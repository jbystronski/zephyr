import { compileWorkflow } from "./ast-compiler.js";
import { createExecutor } from "./executor.js";
import {
  ExecutionPlan,
  RuntimeOptions,
  ServiceMetaRegistry,
  ServiceRegistry,
  WorkflowDef,
  WorkflowInput,
  WorkflowOutput,
} from "./types.js";

type RunFn = {
  <WF extends WorkflowDef<any, any>>(
    ...args: WorkflowInput<WF> extends never
      ? [wf: WF]
      : [wf: WF, input: WorkflowInput<WF>]
  ): Promise<{
    output: WorkflowOutput<WF>;
    extras: Record<string, unknown>;
  }>;
};

export function createRuntime<S extends ServiceRegistry>({
  precompileWorkflows,
  services,
  meta,
  options,
}: {
  precompileWorkflows?: WorkflowDef<any, any>[];
  services: S;
  meta?: ServiceMetaRegistry<any>;
  options?: RuntimeOptions;
}) {
  const compiledCache: Map<string, ExecutionPlan> = new Map();

  const precompile = (wfs?: WorkflowDef<any, any>[]) => {
    if (wfs?.length) {
      for (const wf of wfs ?? []) {
        compileWorkflow(wf, { meta }, compiledCache);
      }
    }
  };

  precompile(precompileWorkflows);

  const exec = (async (wf: any, input?: any): Promise<any> => {
    const plan = compileWorkflow(wf, { meta }, compiledCache);

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
      if (input !== undefined) {
        results[plan.initIdx] = input;
      }
    }

    const output = await executor(results, {});

    return {
      output,
      extras: {},
    };
  }) as RunFn;

  return { exec };

  // return {
  //   run: async <WF extends WorkflowDef<any, any>>(
  //     wf: WF,
  //     input: WorkflowInput<WF>,
  //   ): Promise<{
  //     output: WorkflowOutput<WF>;
  //     extras: Record<string, unknown>;
  //   }> => {
  //     const plan = compileWorkflow(wf, { meta }, compiledCache);
  //
  //     if (!plan) {
  //       throw new Error(`Compiled plan not found`);
  //     } else {
  //       const executor = createExecutor(
  //         plan,
  //         services as any,
  //         options?.global?.observers ?? [],
  //       );
  //
  //       const results = new Array(plan.maxIndex + 1);
  //
  //       if (typeof plan.initIdx === "number") {
  //         results[plan.initIdx] = input;
  //       }
  //
  //       const output = await executor(results, {});
  //
  //       return {
  //         output,
  //         extras: {},
  //       };
  //     }
  //   },
  // };
}

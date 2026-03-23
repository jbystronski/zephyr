import { ActionRegistry } from "./types.js";
import { WorkflowDef } from "./workflow-composer.js";
import { executeWorkflow } from "./workflow-executor.js";

// Just type helpers - no runtime wrappers needed
type AnyFn = (...args: any[]) => any;
type Input<F extends AnyFn> = Parameters<F>[0];
type Output<F extends AnyFn> = Awaited<ReturnType<F>>;

/**
 * For generic actions - preserves the generic parameter
 */
export function genericAction<F extends AnyFn>(fn: F) {
  // Return a function that takes a type parameter and returns the typed function
  return <T>(): ((...args: Parameters<F>) => ReturnType<F>) => {
    return fn as (...args: Parameters<F>) => ReturnType<F>;
  };
}

/**
 * For fixed actions
 */
export function fixedAction<F extends AnyFn>(fn: F) {
  return (): ((...args: Parameters<F>) => ReturnType<F>) => {
    return fn as (...args: Parameters<F>) => ReturnType<F>;
  };
}

export function createRunner<Reg extends ActionRegistry>(registry: Reg) {
  return async <W extends WorkflowDef<Reg, any, any, any, any>>(
    workflow: W,
    input: W extends WorkflowDef<Reg, infer I, any, any, any> ? I : never,
    observers?: any[],
  ): Promise<{
    output: W extends WorkflowDef<Reg, any, any, any, infer O> ? O : never;
    results: W extends WorkflowDef<Reg, any, infer R, any, any> ? R : never;
    extras: Record<string, any>;
  }> => {
    return executeWorkflow(workflow, registry, input, observers ?? []);
  };
}

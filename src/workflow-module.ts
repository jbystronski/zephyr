import { ActionRegistry } from "./types.js";
import {
  createWorkflow,
  WorkflowBuilder,
  WorkflowDef,
} from "./workflow-composer.js";

type AnyWorkflow = WorkflowDef<any, any, any, any, any>;

type ModuleShape = Record<string, AnyWorkflow>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

type UnionToIntersectionOrEmpty<U> = [U] extends [never]
  ? {}
  : UnionToIntersection<U>;

export type ModuleContext<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Deps extends ModuleShape,
> = {
  wf: ReturnType<typeof createWorkflow<Reg, Context>>;

  deps: Deps;
  context: Context;

  tools: <T>(
    factory: (ctx: {
      wf: ModuleContext<Reg, Context, Deps>["wf"];
      deps: Deps;
      context: Context;
    }) => T,
  ) => T;
};

export function createModule<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Use extends ModuleShape[] = [],
  Deps extends ModuleShape = UnionToIntersectionOrEmpty<Use[number]> &
    ModuleShape,
  Own extends ModuleShape = {},
>({
  registry,
  context,
  use,
  define,
}: {
  registry: Reg;
  context: Context;
  use?: [...Use]; // 👈 preserves tuple inference
  define: (ctx: ModuleContext<Reg, Context, Deps>) => Own;
}): Deps & Own {
  const wf = createWorkflow(registry, context);

  const deps = (use ? Object.assign({}, ...use) : {}) as Deps;

  const moduleCtx: ModuleContext<Reg, Context, Deps> = {
    wf,
    deps,
    context,

    tools: (factory) => factory({ wf, deps, context }),
  };

  const own = define(moduleCtx);

  return {
    ...deps,
    ...own,
  };
}

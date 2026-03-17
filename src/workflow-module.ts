import { ActionRegistry } from "./types.js";
import { createWorkflow, WorkflowDef } from "./workflow-composer.js";

// export function workflowModule<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
//   Flows extends Record<string, any>,
// >(
//   registry: Reg,
//   context: Context,
//   factory: (wf: ReturnType<typeof createWorkflow<Reg, Context>>) => Flows,
// ) {
//   const wf = createWorkflow(registry, context);
//   const flows = factory(wf);
//
//   return {
//     ...flows,
//     extend(overrides: Partial<Flows>): Flows {
//       return {
//         ...flows,
//         ...overrides,
//       };
//     },
//   };
// }

export function workflowModule<
  Reg extends ActionRegistry,
  Context extends Record<string, any>,
  Flows extends Record<string, any>,
>(
  registry: Reg,
  context: Context,
  factory: (wf: ReturnType<typeof createWorkflow<Reg, Context>>) => Flows,
) {
  const wf = createWorkflow(registry, context);
  const flows = factory(wf);

  return {
    wf,
    ...flows,

    extend<Extra extends Record<string, any>>(overrides: Extra): Flows & Extra {
      return {
        ...flows,
        ...overrides,
      };
    },
  };
}

// export function createModule<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any>,
//   Flows extends Record<string, any>,
//   Deps extends any[],
// >({
//   registry,
//   context,
//   use = [],
//   define,
// }: {
//   registry: Reg;
//   context: Context;
//   use?: Array<(wf: any) => Record<string, any>>;
//   define?: (wf: ReturnType<typeof createWorkflow<Reg, Context>>) => Flows;
// }) {
//   const wf = createWorkflow(registry, context);
//
//   const inherited = Object.assign({}, ...use.map((f) => f(wf)));
//   const own = define ? define(wf) : {};
//
//   const flows = {
//     ...inherited,
//     ...own,
//   };
//
//   return {
//     wf,
//     flows,
//     ...flows,
//   };
// }
//

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
  define: (
    wf: ReturnType<typeof createWorkflow<Reg, Context>>,
    deps: Deps,
  ) => Own;
}): Deps & Own {
  const wf = createWorkflow(registry, context);

  const deps = (use ? Object.assign({}, ...use) : {}) as Deps;

  const own = define(wf, deps);

  return {
    ...deps,
    ...own,
  };
}

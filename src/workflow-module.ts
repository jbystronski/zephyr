import { ActionRegistry } from "./types.js";
import { createWorkflow } from "./workflow-composer.js";

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

    extend<Extra extends Record<string, any>>(
      overrides: Partial<Flows> & Extra,
    ): Flows & Extra {
      return {
        ...flows,
        ...overrides,
      };
    },
  };
}

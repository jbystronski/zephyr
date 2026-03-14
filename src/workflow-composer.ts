// import { ActionRegistry } from "../registry/types.js";
//
// type StepResult<
//   Reg extends ActionRegistry,
//   ActionName extends keyof Reg,
// > = Awaited<ReturnType<Reg[ActionName]>>;
//
// export type StepDef<
//   Reg extends ActionRegistry,
//   ID extends string = string,
//   ActionName extends keyof Reg = any,
// > = {
//   id: ID;
//   action: ActionName;
//   dependsOn: string[];
//   resolve: (ctx: any) => Parameters<Reg[ActionName]>[0];
//   when?: (ctx: any) => boolean;
// };
//
// export type WorkflowDef<
//   Reg extends ActionRegistry,
//   Input,
//   Results,
//   Steps extends StepDef<Reg, any, any>[] = StepDef<Reg, any, any>[],
// > = {
//   name: string;
//   steps: Steps;
//   entrySteps: StepDef<Reg>[];
//   endSteps: StepDef<Reg>[];
//   input: Input;
//   results: Results;
// };
//
// type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
//   k: infer I,
// ) => void
//   ? I
//   : never;
//
// export class WorkflowBuilder<
//   Reg extends ActionRegistry,
//   Input = unknown,
//   Steps extends StepDef<Reg, any, any>[] = [],
//   Results = {},
// > {
//   private steps: StepDef<Reg, any, any>[] = [];
//   private frontier: string[] = [];
//
//   constructor(
//     private name: string,
//     private registry: Reg,
//   ) {}
//
//   /* ------------------------------------------------ */
//   /* Base Step                                         */
//   /* ------------------------------------------------ */
//
//   step<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//     dependsOn?: string[],
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     [...Steps, StepDef<Reg, ID, ActionName>],
//     Results & { [K in ID]: StepResult<Reg, ActionName> }
//   > {
//     const deps = dependsOn ?? [...this.frontier];
//
//     this.steps.push({
//       id,
//       action,
//       resolve,
//       dependsOn: deps,
//     });
//
//     this.frontier = [id];
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Sequential shortcut                               */
//   /* ------------------------------------------------ */
//
//   seq<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve);
//   }
//
//   /* ------------------------------------------------ */
//   /* Parallel branches                                 */
//   /* ------------------------------------------------ */
//
//   parallel<Branches extends WorkflowBuilder<Reg, Input, any, any>[]>(
//     ...branches: {
//       [K in keyof Branches]: (
//         builder: WorkflowBuilder<Reg, Input, [], Results>,
//       ) => Branches[K];
//     }
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     [
//       ...Steps,
//       ...(Branches[number] extends WorkflowBuilder<Reg, any, infer S, any>
//         ? S
//         : never),
//     ],
//     Results &
//       (Branches[number] extends WorkflowBuilder<Reg, any, any, infer R>
//         ? UnionToIntersection<R>
//         : {})
//   > {
//     const parentFrontier = [...this.frontier];
//     const branchEnds: string[] = [];
//
//     branches.forEach((branch) => {
//       const b = new WorkflowBuilder<Reg, Input, [], Results>(
//         this.name,
//         this.registry,
//       );
//
//       b.frontier = parentFrontier;
//
//       branch(b);
//
//       branchEnds.push(...b.frontier);
//
//       this.steps.push(...(b as any).steps);
//     });
//
//     this.frontier = branchEnds;
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Join helper                                       */
//   /* ------------------------------------------------ */
//
//   join<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve, [...this.frontier]);
//   }
//
//   /* ------------------------------------------------ */
//   /* Subflow                                           */
//   /* ------------------------------------------------ */
//
//   subflow<
//     Prefix extends string,
//     SubInput,
//     SubResults,
//     SubSteps extends StepDef<Reg, any, any>[],
//   >(
//     prefix: Prefix,
//     workflow: WorkflowDef<Reg, SubInput, SubResults, SubSteps>,
//     resolveInput: (ctx: { input: Input; results: Results }) => SubInput,
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     [...Steps, ...SubSteps],
//     Results & { [K in Prefix]: SubResults }
//   > {
//     const idMap = new Map<string, string>();
//
//     workflow.steps.forEach((step) => {
//       idMap.set(step.id, `${prefix}.${step.id}`);
//     });
//
//     workflow.steps.forEach((step) => {
//       const newStep = {
//         ...step,
//
//         id: idMap.get(step.id)!,
//
//         dependsOn: step.dependsOn.map((d) => idMap.get(d)!),
//
//         resolve: (ctx: any) => {
//           const subInput = resolveInput(ctx);
//
//           return step.resolve({
//             input: subInput,
//             results: ctx.results,
//           });
//         },
//       };
//
//       if (workflow.entrySteps.find((e) => e.id === step.id)) {
//         newStep.dependsOn = [...this.frontier];
//       }
//
//       this.steps.push(newStep);
//     });
//
//     this.frontier = workflow.endSteps.map((e) => idMap.get(e.id)!);
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Build                                             */
//   /* ------------------------------------------------ */
//
//   build(): WorkflowDef<Reg, Input, Results, Steps> {
//     this.validateDependencies();
//
//     return {
//       name: this.name,
//
//       steps: this.steps as Steps,
//
//       entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
//
//       endSteps: this.getEndSteps(),
//
//       input: {} as Input,
//
//       results: {} as Results,
//     };
//   }
//
//   /* ------------------------------------------------ */
//
//   private validateDependencies() {
//     const stepIds = new Set(this.steps.map((s) => s.id));
//
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         if (!stepIds.has(dep)) {
//           throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
//         }
//       }
//     }
//   }
//
//   private getEndSteps() {
//     const hasDependents = new Set<string>();
//
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         hasDependents.add(dep);
//       }
//     }
//
//     return this.steps.filter((s) => !hasDependents.has(s.id));
//   }
// }
//
// // export function createWorkflow<Reg extends ActionRegistry, Input = unknown>(
// //   registry: Reg,
// // ) {
// //   return (name: string) => new WorkflowBuilder<Reg, Input>(name, registry);
// // }
//
// export function createWorkflow<Reg extends ActionRegistry>(registry: Reg) {
//   return function workflow<Input = unknown>(name: string) {
//     return new WorkflowBuilder<Reg, Input>(name, registry);
//   };
// }
//

import { ActionRegistry } from "./types.js";

type StepResult<
  Reg extends ActionRegistry,
  ActionName extends keyof Reg,
> = Awaited<ReturnType<Reg[ActionName]>>;

export type StepDef<
  Reg extends ActionRegistry,
  ID extends string = string,
  ActionName extends keyof Reg = any,
> = {
  id: ID;
  action: ActionName;
  dependsOn: string[];
  resolve: (ctx: any) => Parameters<Reg[ActionName]>[0];
  when?: (ctx: any) => boolean;
};

export type WorkflowDef<
  Reg extends ActionRegistry,
  Input,
  Results,
  Steps extends StepDef<Reg, any, any>[] = StepDef<Reg, any, any>[],
  Output = undefined,
> = {
  name: string;
  steps: Steps;
  entrySteps: StepDef<Reg>[];
  endSteps: StepDef<Reg>[];
  input: Input;
  results: Results;
  outputResolver?: (ctx: any) => Output;
};

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export class WorkflowBuilder<
  Reg extends ActionRegistry,
  Input = unknown,
  Steps extends StepDef<Reg, any, any>[] = [],
  Results = {},
> {
  private steps: StepDef<Reg, any, any>[] = [];
  private frontier: string[] = [];

  private outputResolver?: (ctx: any) => any;
  constructor(
    private name: string,
    private registry: Reg,
  ) {}

  /* ------------------------------------------------ */
  /* Base Step                                         */
  /* ------------------------------------------------ */

  step<ID extends string, ActionName extends keyof Reg & string>(
    id: ID,
    action: ActionName,
    resolve: (ctx: {
      input: Input;
      results: Results;
    }) => Parameters<Reg[ActionName]>[0],
    dependsOn?: string[],
  ): WorkflowBuilder<
    Reg,
    Input,
    [...Steps, StepDef<Reg, ID, ActionName>],
    Results & { [K in ID]: StepResult<Reg, ActionName> }
  > {
    const deps = dependsOn ?? [...this.frontier];

    this.steps.push({
      id,
      action,
      resolve,
      dependsOn: deps,
    });

    this.frontier = [id];

    return this as any;
  }

  /* ------------------------------------------------ */
  /* Sequential shortcut                               */
  /* ------------------------------------------------ */

  seq<ID extends string, ActionName extends keyof Reg & string>(
    id: ID,
    action: ActionName,
    resolve: (ctx: {
      input: Input;
      results: Results;
    }) => Parameters<Reg[ActionName]>[0],
  ) {
    return this.step(id, action, resolve);
  }

  /* ------------------------------------------------ */
  /* Parallel branches                                 */
  parallel<Branches extends WorkflowBuilder<Reg, Input, any, any>[]>(
    ...branches: {
      [K in keyof Branches]: (
        builder: WorkflowBuilder<Reg, Input, [], Results>,
      ) => Branches[K];
    }
  ): WorkflowBuilder<
    Reg,
    Input,
    [
      ...Steps,
      ...(Branches[number] extends WorkflowBuilder<Reg, any, infer S, any>
        ? S
        : never),
    ],
    Results &
      (Branches[number] extends WorkflowBuilder<Reg, any, any, infer R>
        ? UnionToIntersection<R>
        : {})
  > {
    const parentFrontier = [...this.frontier];
    const branchEnds: string[] = [];

    branches.forEach((branch) => {
      const b = new WorkflowBuilder<Reg, Input, [], Results>(
        this.name,
        this.registry,
      );

      b.frontier = parentFrontier;

      branch(b);

      branchEnds.push(...b.frontier);

      this.steps.push(...(b as any).steps);
    });

    this.frontier = branchEnds;

    return this as any;
  }

  /* ------------------------------------------------ */
  /* Join helper                                       */
  /* ------------------------------------------------ */

  join<ID extends string, ActionName extends keyof Reg & string>(
    id: ID,
    action: ActionName,
    resolve: (ctx: {
      input: Input;
      results: Results;
    }) => Parameters<Reg[ActionName]>[0],
  ) {
    return this.step(id, action, resolve, [...this.frontier]);
  }

  /* ------------------------------------------------ */
  /* Subflow                                           */
  /* ------------------------------------------------ */

  subflow<
    Prefix extends string,
    SubInput,
    SubResults,
    SubSteps extends StepDef<Reg, any, any>[],
  >(
    prefix: Prefix,
    workflow: WorkflowDef<Reg, SubInput, SubResults, SubSteps>,
    resolveInput: (ctx: { input: Input; results: Results }) => SubInput,
  ): WorkflowBuilder<
    Reg,
    Input,
    [...Steps, ...SubSteps],
    Results & { [K in Prefix]: SubResults }
  > {
    const idMap = new Map<string, string>();

    workflow.steps.forEach((step) => {
      idMap.set(step.id, `${prefix}.${step.id}`);
    });

    workflow.steps.forEach((step) => {
      const newStep = {
        ...step,

        id: idMap.get(step.id)!,

        dependsOn: step.dependsOn.map((d) => idMap.get(d)!),

        resolve: (ctx: any) => {
          const subInput = resolveInput(ctx);

          return step.resolve({
            input: subInput,
            results: ctx.results,
          });
        },
      };

      if (workflow.entrySteps.find((e) => e.id === step.id)) {
        newStep.dependsOn = [...this.frontier];
      }

      this.steps.push(newStep);
    });

    this.frontier = workflow.endSteps.map((e) => idMap.get(e.id)!);

    return this as any;
  }

  output<Output>(
    fn: (ctx: { input: Input; results: Results }) => Output,
  ): WorkflowDef<Reg, Input, Results, Steps, Output> {
    this.outputResolver = fn;
    return this.build() as WorkflowDef<Reg, Input, Results, Steps, Output>;
  }
  /* ------------------------------------------------ */
  /* Build                                             */
  /* ------------------------------------------------ */
  build(): WorkflowDef<Reg, Input, Results, Steps> {
    this.validateDependencies();

    return {
      name: this.name,
      steps: this.steps as Steps,
      entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
      endSteps: this.getEndSteps(),
      input: {} as Input,
      results: {} as Results,
      outputResolver: this.outputResolver,
    };
  }

  /* ------------------------------------------------ */

  private validateDependencies() {
    const stepIds = new Set(this.steps.map((s) => s.id));

    for (const step of this.steps) {
      for (const dep of step.dependsOn) {
        if (!stepIds.has(dep)) {
          throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
        }
      }
    }
  }

  private getEndSteps() {
    const hasDependents = new Set<string>();

    for (const step of this.steps) {
      for (const dep of step.dependsOn) {
        hasDependents.add(dep);
      }
    }

    return this.steps.filter((s) => !hasDependents.has(s.id));
  }
}

// export function createWorkflow<Reg extends ActionRegistry, Input = unknown>(
//   registry: Reg,
// ) {
//   return (name: string) => new WorkflowBuilder<Reg, Input>(name, registry);
// }

export function createWorkflow<Reg extends ActionRegistry>(registry: Reg) {
  return function workflow<Input = unknown>(name: string) {
    return new WorkflowBuilder<Reg, Input>(name, registry);
  };
}

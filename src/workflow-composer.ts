// import { ActionRegistry, ActionReturn } from "./types.js";
//
// /* ------------------------------------------------ */
// /* STEP INPUT NORMALIZATION TYPES                  */
// /* ------------------------------------------------ */
//
// export type NormalizedCall =
//   | { kind: "none" }
//   | { kind: "positional"; args: any[] }
//   | { kind: "object"; args: any };
//
// export type ResolvedStepInput =
//   | NormalizedCall
//   | { kind: "loop"; items: NormalizedCall[] };
//
// /* ------------------------------------------------ */
// /* STEP RESULT TYPES                               */
// /* ------------------------------------------------ */
//
// type SubflowResult<SubResults, SubOutput> = SubOutput extends undefined
//   ? SubResults
//   : SubOutput;
//
// export type StepResult<
//   Reg extends ActionRegistry,
//   ActionName extends keyof Reg,
//   Loop extends boolean | undefined = undefined,
// > = Loop extends true
//   ? ActionReturn<Reg, ActionName>[]
//   : ActionReturn<Reg, ActionName>;
//
// /* ------------------------------------------------ */
// /* STEP DEFINITION                                 */
// /* ------------------------------------------------ */
//
// export type StepDef<
//   Reg extends ActionRegistry,
//   ID extends string = string,
//   ActionName extends keyof Reg = any,
// > = {
//   id: ID;
//   action: ActionName;
//   dependsOn: string[];
//   resolve: (ctx: any) => ResolvedStepInput;
//   when?: (ctx: any) => boolean;
//   loop?: boolean;
// };
//
// /* ------------------------------------------------ */
// /* WORKFLOW DEFINITION                             */
// /* ------------------------------------------------ */
//
// export type WorkflowDef<
//   Reg extends ActionRegistry,
//   Input,
//   Results,
//   Steps extends StepDef<Reg, any, any>[] = StepDef<Reg, any, any>[],
//   Output = undefined,
// > = {
//   name: string;
//   steps: Steps;
//   entrySteps: StepDef<Reg>[];
//   endSteps: StepDef<Reg>[];
//   input: Input;
//   results: Results;
//   outputResolver?: (ctx: any) => Output;
//   __context?: any;
// };
//
// /* ------------------------------------------------ */
// /* HELPER TYPES                                    */
// /* ------------------------------------------------ */
//
// type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
//   k: infer I,
// ) => void
//   ? I
//   : never;
//
// /* ------------------------------------------------ */
// /* FLUENT WORKFLOW BUILDER                          */
// /* ------------------------------------------------ */
//
// export class WorkflowBuilder<
//   Reg extends ActionRegistry,
//   Input = unknown,
//   Context extends Record<string, any> = {},
//   Steps extends StepDef<Reg, any, any>[] = [],
//   Results = {},
//   Output = undefined,
// > {
//   private steps: StepDef<Reg, any, any>[] = [];
//   private frontier: string[] = [];
//   private outputResolver?: (ctx: any) => any;
//
//   constructor(
//     private name: string,
//     private registry: Reg,
//     private context: Context,
//   ) {}
//
//   /* ------------------------------------------------ */
//   /* Base Step                                       */
//   /* ------------------------------------------------ */
//   step<
//     ID extends string,
//     ActionName extends keyof Reg & string,
//     Loop extends boolean | undefined = undefined,
//   >(
//     id: ID,
//     action: ActionName,
//     resolve?: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => ResolvedStepInput,
//     dependsOn?: string[],
//     options?: { loop?: Loop },
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [...Steps, StepDef<Reg, ID, ActionName>],
//     Results & { [K in ID]: StepResult<Reg, ActionName, Loop> }
//   > {
//     const deps = dependsOn ?? [...this.frontier];
//
//     this.steps.push({
//       id,
//       action,
//       resolve: resolve ?? (() => ({ kind: "none" })),
//       dependsOn: deps,
//       loop: options?.loop ?? false,
//     });
//
//     this.frontier = [id];
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Sequential shortcut                             */
//   /* ------------------------------------------------ */
//   seq<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve?: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => ResolvedStepInput,
//     options?: { loop?: boolean },
//   ) {
//     return this.step(id, action, resolve, undefined, options);
//   }
//
//   /* ------------------------------------------------ */
//   /* Parallel branches                               */
//   /* ------------------------------------------------ */
//   parallel<Branches extends WorkflowBuilder<Reg, Input, Context, any, any>[]>(
//     ...branches: {
//       [K in keyof Branches]: (
//         builder: WorkflowBuilder<Reg, Input, Context, [], Results>,
//       ) => Branches[K];
//     }
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [
//       ...Steps,
//       ...(Branches[number] extends WorkflowBuilder<Reg, any, any, infer S, any>
//         ? S
//         : never),
//     ],
//     Results &
//       (Branches[number] extends WorkflowBuilder<Reg, any, any, any, infer R>
//         ? UnionToIntersection<R>
//         : {})
//   > {
//     const parentFrontier = [...this.frontier];
//     const branchEnds: string[] = [];
//
//     branches.forEach((branch) => {
//       const b = new WorkflowBuilder<Reg, Input, Context, [], Results>(
//         this.name,
//         this.registry,
//         this.context,
//       );
//
//       b.frontier = parentFrontier;
//       branch(b);
//       branchEnds.push(...b.frontier);
//       this.steps.push(...(b as any).steps);
//     });
//
//     this.frontier = branchEnds;
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Join helper                                     */
//   /* ------------------------------------------------ */
//   join<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve?: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => ResolvedStepInput,
//     options?: { loop?: boolean },
//   ) {
//     return this.step(id, action, resolve, [...this.frontier], options);
//   }
//
//   /* ------------------------------------------------ */
//   /* Subflow                                         */
//   /* ------------------------------------------------ */
//   subflow<
//     Prefix extends string,
//     SubInput,
//     SubResults,
//     SubSteps extends StepDef<Reg, any, any>[],
//     SubOutput,
//   >(
//     prefix: Prefix,
//     workflow: WorkflowDef<Reg, SubInput, SubResults, SubSteps, SubOutput>,
//     resolveInput?: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => SubInput,
//     options?: { loop?: boolean },
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [...Steps, ...SubSteps],
//     Results & { [K in Prefix]: SubflowResult<SubResults, SubOutput> }
//   > {
//     const idMap = new Map<string, string>();
//
//     workflow.steps.forEach((step) => {
//       idMap.set(step.id, `${prefix}.${step.id}`);
//     });
//
//     workflow.steps.forEach((step) => {
//       const newStep: StepDef<Reg, any, any> = {
//         ...step,
//         id: idMap.get(step.id)!,
//         dependsOn: step.dependsOn.map((d) => idMap.get(d)!),
//         resolve: (ctx: any) => {
//           const subInput = resolveInput ? resolveInput(ctx) : undefined;
//           return step.resolve({
//             input: subInput,
//             results: ctx.results,
//             context: ctx.context,
//           });
//         },
//         ...(options ? { loop: options.loop ?? step.loop } : {}),
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
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Conditional                                      */
//   /* ------------------------------------------------ */
//   when(
//     predicate: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => boolean,
//   ): this {
//     const lastStep = this.steps[this.steps.length - 1];
//     if (!lastStep) throw new Error("when() must follow a step");
//     lastStep.when = predicate;
//     return this;
//   }
//
//   /* ------------------------------------------------ */
//   /* Workflow output                                  */
//   /* ------------------------------------------------ */
//   output<Output>(
//     fn: (ctx: { input: Input; results: Results; context: Context }) => Output,
//   ): WorkflowDef<Reg, Input, Results, Steps, Output> {
//     this.outputResolver = fn;
//     return this.build() as WorkflowDef<Reg, Input, Results, Steps, Output>;
//   }
//
//   build(): WorkflowDef<Reg, Input, Results, Steps> {
//     this.validateDependencies();
//
//     return {
//       name: this.name,
//       steps: this.steps as Steps,
//       entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
//       endSteps: this.getEndSteps(),
//       input: {} as Input,
//       results: {} as Results,
//       outputResolver: this.outputResolver,
//       __context: this.context,
//     };
//   }
//
//   private validateDependencies() {
//     const stepIds = new Set(this.steps.map((s) => s.id));
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         if (!stepIds.has(dep))
//           throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
//       }
//     }
//   }
//
//   private getEndSteps() {
//     const hasDependents = new Set<string>();
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) hasDependents.add(dep);
//     }
//     return this.steps.filter((s) => !hasDependents.has(s.id));
//   }
//
//   /* ------------------------------------------------ */
//   /* STATIC HELPERS FOR NORMALIZATION                */
//   /* ------------------------------------------------ */
//   static args = (...args: any[]): NormalizedCall => ({
//     kind: "positional",
//     args,
//   });
//   static obj = (args: any): NormalizedCall => ({ kind: "object", args });
//   static none = (): NormalizedCall => ({ kind: "none" });
//   static loop = (items: NormalizedCall[]): ResolvedStepInput => ({
//     kind: "loop",
//     items,
//   });
// }
//
// /* ------------------------------------------------ */
// /* WORKFLOW CREATOR                                 */
// /* ------------------------------------------------ */
// export function createWorkflow<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any> = {},
// >(registry: Reg, context?: Context) {
//   return function workflow<Input = unknown>(name: string) {
//     return new WorkflowBuilder<Reg, Input, Context>(
//       name,
//       registry,
//       context || ({} as Context),
//     );
//   };
// }
//

//////////////////////////////////////////////////////////////////////////////

import { ActionParams, ActionRegistry, ActionReturn } from "./types.js";

/* ------------------------------------------------ */
/* STEP INPUT NORMALIZATION TYPES                  */
/* ------------------------------------------------ */

type StepBuilderResult<WB, ID extends string, Default> = WB & {
  as<Override>(): OverrideStepResult<WB, ID, Override>;
};

type OverrideStepResult<WB, ID extends string, Override> =
  WB extends WorkflowBuilder<
    infer Reg,
    infer Input,
    infer Context,
    infer Steps,
    infer Results,
    infer Output
  >
    ? WorkflowBuilder<
        Reg,
        Input,
        Context,
        Steps,
        Omit<Results, ID> & { [K in ID]: Override },
        Output
      >
    : never;

type NormalizedCall =
  | { kind: "none" }
  | { kind: "positional"; args: any[] }
  | { kind: "object"; args: any };

export type ResolvedStepInput =
  | NormalizedCall
  | { kind: "loop"; items: NormalizedCall[] };

type CallHelpers<Reg extends ActionRegistry, ActionName extends keyof Reg> = {
  args: (...args: ActionParams<Reg, ActionName>) => {
    kind: "positional";
    args: ActionParams<Reg, ActionName>;
  };

  obj: ActionParams<Reg, ActionName> extends [infer A]
    ? (arg: A) => { kind: "object"; args: A }
    : never;

  none: () => { kind: "none" };
  loop: (
    items:
      | { kind: "positional"; args: ActionParams<Reg, ActionName> }[]
      | { kind: "object"; args: ActionParams<Reg, ActionName>[0] }[],
  ) => {
    kind: "loop";
    items: typeof items;
  };
};

/* ------------------------------------------------ */
/* STEP RESULT TYPES                               */
/* ------------------------------------------------ */

type SubflowResult<SubResults, SubOutput> = SubOutput extends undefined
  ? SubResults
  : SubOutput;

type WorkflowInput<T> =
  T extends WorkflowDef<any, infer I, any, any, any> ? I : never;

type WorkflowResults<T> =
  T extends WorkflowDef<any, any, infer R, any, any> ? R : never;

type WorkflowOutput<T> =
  T extends WorkflowDef<any, any, any, any, infer O> ? O : never;

export type StepResultFromResolve<
  Reg extends ActionRegistry,
  ActionName extends keyof Reg,
  R extends ResolvedStepInput,
> = R extends { kind: "loop" }
  ? ActionReturn<Reg, ActionName>[]
  : ActionReturn<Reg, ActionName>;

/* ------------------------------------------------ */
/* STEP DEFINITION                                 */
/* ------------------------------------------------ */

export type StepDef<
  Reg extends ActionRegistry,
  ID extends string = string,
  ActionName extends keyof Reg = any,
> = {
  id: ID;
  action: ActionName;
  dependsOn: string[];
  resolve: (ctx: any) => ResolvedStepInput;
  when?: (ctx: any) => boolean;
};

/* ------------------------------------------------ */
/* WORKFLOW DEFINITION                             */
/* ------------------------------------------------ */

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
  __context?: any;
};

/* ------------------------------------------------ */
/* HELPER TYPES                                    */
/* ------------------------------------------------ */

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

/* ------------------------------------------------ */
/* FLUENT WORKFLOW BUILDER                          */
/* ------------------------------------------------ */

export class WorkflowBuilder<
  Reg extends ActionRegistry,
  Input = unknown,
  Context extends Record<string, any> = {},
  Steps extends StepDef<Reg, any, any>[] = [],
  Results = {},
  Output = undefined,
> {
  private steps: StepDef<Reg, any, any>[] = [];
  private frontier: string[] = [];
  private outputResolver?: (ctx: any) => any;

  constructor(
    private name: string,
    private registry: Reg,
    private context: Context,
  ) {}

  /* ------------------------------------------------ */
  /* Base Step                                       */
  /* ------------------------------------------------ */
  // step<
  //   ID extends string,
  //   ActionName extends keyof Reg & string,
  //   ResolveOut extends ResolvedStepInput = ResolvedStepInput,
  // >(
  //   id: ID,
  //   action: ActionName,
  //   resolve?: (
  //     ctx: {
  //       input: Input;
  //       results: Results;
  //       context: Context;
  //     } & CallHelpers<Reg, ActionName>,
  //   ) => ResolveOut,
  //   dependsOn?: string[],
  //   options?: {},
  // ): WorkflowBuilder<
  //   Reg,
  //   Input,
  //   Context,
  //   [...Steps, StepDef<Reg, ID, ActionName>],
  //   Results & { [K in ID]: StepResultFromResolve<Reg, ActionName, ResolveOut> }
  // > {
  //   const deps = dependsOn ?? [...this.frontier];
  //
  //   this.steps.push({
  //     id,
  //     action,
  //     resolve: resolve ?? (() => ({ kind: "none" })),
  //     dependsOn: deps,
  //   });
  //
  //   this.frontier = [id];
  //
  //   // with Override
  //
  //   return this as any;
  // }

  /* ------------------------------------------------ */
  /* Base Step                                       */
  /* ------------------------------------------------ */
  step<
    ID extends string,
    ActionName extends keyof Reg & string,
    ResolveOut extends ResolvedStepInput = ResolvedStepInput,
  >(
    id: ID,
    action: ActionName,
    resolve?: (
      ctx: {
        input: Input;
        results: Results;
        context: Context;
      } & CallHelpers<Reg, ActionName>,
    ) => ResolveOut,
    dependsOn?: string[],
    options?: {},
  ): StepBuilderResult<
    WorkflowBuilder<
      Reg,
      Input,
      Context,
      [...Steps, StepDef<Reg, ID, ActionName>],
      Results & {
        [K in ID]: StepResultFromResolve<Reg, ActionName, ResolveOut>;
      },
      Output
    >,
    ID,
    StepResultFromResolve<Reg, ActionName, ResolveOut>
  > {
    const deps = dependsOn ?? [...this.frontier];

    this.steps.push({
      id,
      action,
      resolve: resolve ?? (() => ({ kind: "none" })),
      dependsOn: deps,
    });

    this.frontier = [id];

    // with Override

    const next = this as any;

    (next as any).as = <Override>() => {
      return next as OverrideStepResult<typeof next, ID, Override>;
    };
    return next;
    // return this as any;
  }

  /* ------------------------------------------------ */
  /* Sequential shortcut                             */
  /* ------------------------------------------------ */
  seq<
    ID extends string,
    ActionName extends keyof Reg & string,
    ResolveOut extends ResolvedStepInput = ResolvedStepInput,
  >(
    id: ID,
    action: ActionName,
    resolve?: (
      ctx: {
        input: Input;
        results: Results;
        context: Context;
      } & CallHelpers<Reg, ActionName>,
    ) => ResolveOut,
    options?: {},
  ) {
    return this.step<ID, ActionName, ResolveOut>(
      id,
      action,
      resolve,
      undefined,
      options,
    );
  }

  /* ------------------------------------------------ */
  /* Parallel branches                               */
  /* ------------------------------------------------ */
  parallel<Branches extends WorkflowBuilder<Reg, Input, Context, any, any>[]>(
    ...branches: {
      [K in keyof Branches]: (
        builder: WorkflowBuilder<Reg, Input, Context, [], Results>,
      ) => Branches[K];
    }
  ): WorkflowBuilder<
    Reg,
    Input,
    Context,
    [
      ...Steps,
      ...(Branches[number] extends WorkflowBuilder<Reg, any, any, infer S, any>
        ? S
        : never),
    ],
    Results &
      (Branches[number] extends WorkflowBuilder<Reg, any, any, any, infer R>
        ? UnionToIntersection<R>
        : {})
  > {
    const parentFrontier = [...this.frontier];
    const branchEnds: string[] = [];

    branches.forEach((branch) => {
      const b = new WorkflowBuilder<Reg, Input, Context, [], Results>(
        this.name,
        this.registry,
        this.context,
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
  /* Join helper                                     */
  /* ------------------------------------------------ */
  join<
    ID extends string,
    ActionName extends keyof Reg & string,
    ResolveOut extends ResolvedStepInput = ResolvedStepInput,
  >(
    id: ID,
    action: ActionName,
    resolve?: (
      ctx: {
        input: Input;
        results: Results;
        context: Context;
      } & CallHelpers<Reg, ActionName>,
    ) => ResolveOut,
    options?: {},
  ) {
    return this.step<ID, ActionName, ResolveOut>(
      id,
      action,
      resolve,
      [...this.frontier],
      options,
    );
  }

  /* ------------------------------------------------ */
  /* Subflow                                         */
  /* ------------------------------------------------ */

  subflow<
    Prefix extends string,
    SubSteps extends StepDef<Reg, any, any>[],
    WF extends WorkflowDef<Reg, any, any, SubSteps, any>,
  >(
    prefix: Prefix,
    workflow: WF,
    resolveInput: WorkflowInput<WF> extends undefined
      ?
          | ((ctx: {
              input: Input;
              results: Results;
              context: Context;
            }) => WorkflowInput<WF>)
          | undefined
      : (ctx: {
          input: Input;
          results: Results;
          context: Context;
        }) => WorkflowInput<WF>,
    options?: {},
  ): WorkflowBuilder<
    Reg,
    Input,
    Context,
    [...Steps, ...WF["steps"]],
    Results & {
      [K in Prefix]: SubflowResult<WorkflowResults<WF>, WorkflowOutput<WF>>;
    }
  > {
    const idMap = new Map<string, string>();

    workflow.steps.forEach((step) => {
      idMap.set(step.id, `${prefix}.${step.id}`);
    });

    workflow.steps.forEach((step) => {
      const newStep: StepDef<Reg, any, any> = {
        ...step,
        id: idMap.get(step.id)!,
        dependsOn: step.dependsOn.map((d) => idMap.get(d)!),
        resolve: (ctx: any) => {
          const subInput = resolveInput ? resolveInput(ctx) : undefined;
          return step.resolve({
            input: subInput,
            results: ctx.results,
            context: ctx.context,
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

  /* ------------------------------------------------ */
  /* Conditional                                      */
  /* ------------------------------------------------ */
  when(
    predicate: (ctx: {
      input: Input;
      results: Results;
      context: Context;
    }) => boolean,
  ): this {
    const lastStep = this.steps[this.steps.length - 1];
    if (!lastStep) throw new Error("when() must follow a step");
    lastStep.when = predicate;
    return this;
  }

  /* ------------------------------------------------ */
  /* Workflow output                                  */
  /* ------------------------------------------------ */
  output<Output>(
    fn: (ctx: { input: Input; results: Results; context: Context }) => Output,
  ): WorkflowDef<Reg, Input, Results, Steps, Output> {
    this.outputResolver = fn;
    return this.build() as WorkflowDef<Reg, Input, Results, Steps, Output>;
  }

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
      __context: this.context,
    };
  }

  private validateDependencies() {
    const stepIds = new Set(this.steps.map((s) => s.id));
    for (const step of this.steps) {
      for (const dep of step.dependsOn) {
        if (!stepIds.has(dep))
          throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
      }
    }
  }

  private getEndSteps() {
    const hasDependents = new Set<string>();
    for (const step of this.steps) {
      for (const dep of step.dependsOn) hasDependents.add(dep);
    }
    return this.steps.filter((s) => !hasDependents.has(s.id));
  }
}

/* ------------------------------------------------ */
/* WORKFLOW CREATOR                                 */
/* ------------------------------------------------ */
export function createWorkflow<
  Reg extends ActionRegistry,
  Context extends Record<string, any> = {},
>(registry: Reg, context?: Context) {
  return function workflow<Input = unknown>(name: string) {
    return new WorkflowBuilder<Reg, Input, Context>(
      name,
      registry,
      context || ({} as Context),
    );
  };
}

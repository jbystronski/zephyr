import {
  ActionParams,
  ActionRegistry,
  ActionReturn,
  CallHelpers,
  NormalizedCall,
  ServiceParams,
  ServiceRegistry,
  ServiceReturn,
  Simplify,
} from "./types.js";
import { generateWorkflowId } from "./utils.js";

/* ------------------------------------------------ */
/* STEP INPUT NORMALIZATION TYPES                  */
/* ------------------------------------------------ */

/* ------------------------------------------------ */
/* STEP RESULT TYPES                               */
/* ------------------------------------------------ */

type WorkflowInput<T> =
  T extends WorkflowDef<any, infer I, any, any, any> ? I : never;

// type WorkflowOutput<T> =
//   T extends WorkflowDef<any, any, any, any, infer O> ? O : never;

type WorkflowOutput<T> =
  T extends WorkflowDef<any, any, any, any, infer O>
    ? unknown extends O
      ? undefined
      : O
    : undefined;

/* ------------------------------------------------ */
/* STEP DEFINITION                                 */
/* ------------------------------------------------ */

export type StepDef<
  Reg extends ActionRegistry,
  ID extends string = string,
  ActionName extends keyof Reg = any,
> = {
  id: ID;
  action: ActionName | "__service__";
  dependsOn: string[];
  resolve: (ctx: any) => NormalizedCall;
  when?: (ctx: any) => boolean;
  options?: StepOptions<any, any>;
  __subflowId?: string;

  serviceCall?: ServiceCall;
  pipe?: { workflow: WorkflowDef<any, any, any> };
  // pipe?: { steps: StepDef<Reg, ID, ActionName>[]; frontier: string[] };
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
  _id: string;
  steps: Steps;
  entrySteps: StepDef<Reg>[];
  endSteps: StepDef<Reg>[];
  input: Input;
  results: Results;
  outputResolver?: (ctx: any) => Output;
  // __context?: any;
};
type StepRuntimeCtx<I, R> = {
  input: I;
  results: R;
};
type StepOptions<Input, Results> = {
  retry?: number;
  retryDelay?: number | ((attempt: number) => number);
  timeout?: number;

  continueOnError?: boolean;

  onError?: (err: unknown, ctx: StepRuntimeCtx<Input, Results>) => any;
  pipe?: {
    parallel?: boolean;
  };

  // optional later:
  label?: string;
  meta?: Record<string, any>;
};

type ServiceCall = {
  service: string;
  method: string;
};

/* ------------------------------------------------ */
/* HELPER TYPES                                    */
/* ------------------------------------------------ */

type MergeBranchResults<
  Branches extends readonly any[],
  Acc,
> = Branches extends readonly [infer Head, ...infer Tail]
  ? MergeBranchResults<
      Tail,
      Acc &
        (Head extends WorkflowBuilder<any, any, any, any, any, infer Results>
          ? Results
          : {})
    >
  : Acc;
type MergeBranchSteps<
  Branches extends readonly any[],
  Acc extends any[],
> = Branches extends readonly [infer Head, ...infer Tail]
  ? MergeBranchSteps<
      Tail,
      [
        ...Acc,
        ...(Head extends WorkflowBuilder<any, any, any, any, infer Steps, any>
          ? Steps
          : []),
      ]
    >
  : Acc;
/* ------------------------------------------------ */
/* FLUENT WORKFLOW BUILDER                          */
/* ------------------------------------------------ */

type LastStepOfBranch<B> =
  B extends WorkflowBuilder<any, any, any, any, any, infer Results>
    ? Results extends Record<string, infer Last>
      ? Last
      : never
    : never;

export class WorkflowBuilder<
  Reg extends ActionRegistry,
  Services extends ServiceRegistry,
  WFReg extends Record<string, WorkflowDef<any, any, any, any, any>>, //
  Input = unknown,
  Steps extends StepDef<Reg, any, any>[] = [],
  Results = {},
  Output = undefined,
> {
  private steps: StepDef<Reg, any, any>[] = [];
  private frontier: string[] = [];
  private pendingWhen?: (
    ctx: {
      input: Input;
      results: Results;
    } & Results,
  ) => boolean;

  private outputResolver?: (ctx: any) => any;
  private clearPendingWhen() {
    this.pendingWhen = undefined;
  }

  constructor(private name: string) {}

  step<ID extends string, ActionName extends keyof Reg & string>(
    id: ID,
    action: ActionName,
    resolve?: (
      ctx: {
        input: Input;
        results: Results;
      } & Results &
        CallHelpers<Reg, ActionName>,
    ) => NormalizedCall,
    dependsOn?: string[],
    options?: StepOptions<Input, Results>,
  ): WorkflowBuilder<
    Reg,
    Services,
    WFReg,
    Input,
    [...Steps, StepDef<Reg, ID, ActionName>],
    Simplify<
      Results & {
        [K in ID]: ActionReturn<Reg, ActionName>;
      }
    >
  > {
    const deps = dependsOn ?? [...this.frontier];

    this.steps.push({
      id,
      action,
      resolve: resolve ?? (() => ({ kind: "none" })),
      dependsOn: deps,
      when: this.pendingWhen,
      options,
    });

    this.frontier = [id];

    return this as any;
  }

  /* ------------------------------------------------ */
  /* Sequential shortcut                             */
  /* ------------------------------------------------ */
  seq<ID extends string = string, ActionName extends keyof Reg & string = any>(
    id: ID,
    action: ActionName,
    resolve?: (
      ctx: {
        input: Input;
        results: Results;
      } & Results &
        CallHelpers<Reg, ActionName>,
    ) => NormalizedCall,
    options?: StepOptions<Input, Results>,
  ) {
    return this.step<ID, ActionName>(id, action, resolve, undefined, options);
  }

  service<
    ID extends string,
    SK extends keyof Services & string,
    MK extends keyof Services[SK] & string,
  >(
    id: ID,
    service: SK,
    method: MK,
    resolve?: (
      ctx: {
        input: Input;
        results: Results;
      } & Results & {
          args: (...args: ServiceParams<Services, SK, MK>) => {
            kind: "positional";
            args: ServiceParams<Services, SK, MK>;
          };
          obj: ServiceParams<Services, SK, MK> extends [infer A]
            ? (arg: A) => { kind: "object"; args: A }
            : never;
          none: () => { kind: "none" };
        },
    ) => NormalizedCall,
    options?: StepOptions<Input, Results>,
  ): WorkflowBuilder<
    Reg,
    Services,
    WFReg,
    Input,
    [...Steps, StepDef<Reg, ID, any>],
    // Simplify<
    //   Results & {
    //     [K in ID]: ResolveOut extends { kind: "loop" }
    //       ? ServiceReturn<Services, SK, MK>[]
    //       : ServiceReturn<Services, SK, MK>;
    //   }
    // >
    Simplify<
      Results & {
        [K in ID]: ServiceReturn<Services, SK, MK>;
      }
    >
  > {
    const deps = [...this.frontier];

    this.steps.push({
      id,
      action: "__service__",
      serviceCall: {
        service,
        method,
      },
      resolve: resolve ?? (() => ({ kind: "none" })),
      dependsOn: deps,
      when: this.pendingWhen,
      options,
    });

    this.frontier = [id];

    return this as any;
  }

  pipe<
    ID extends string,
    Arr extends any[],
    Branch extends WorkflowBuilder<Reg, Services, WFReg, Arr[number], any, any>,
  >(
    id: ID,
    input: (ctx: { input: Input; results: Results } & Results) => Arr,
    builder: (
      b: WorkflowBuilder<Reg, Services, WFReg, Arr[number], [], Results>,
    ) => Branch,
    options?: StepOptions<Input, Results>,
  ): WorkflowBuilder<
    Reg,
    Services,
    WFReg,
    Input,
    Steps,
    Simplify<
      Results & {
        [K in ID]: LastStepOfBranch<Branch>[];
      }
    >
  > {
    const deps = [...this.frontier];

    const branchBuilder = new WorkflowBuilder<
      Reg,
      Services,
      WFReg,
      Arr[number],
      [],
      Results
    >(this.name);

    branchBuilder.frontier = [];
    branchBuilder.pendingWhen = this.pendingWhen;

    const built = builder(branchBuilder);

    const wfId = generateWorkflowId(id);

    const entrySteps = built.steps.filter((s) => s.dependsOn.length === 0);

    const hasDependents = new Set<string>();
    for (const step of built.steps) {
      for (const dep of step.dependsOn) hasDependents.add(dep);
    }
    const endSteps = built.steps.filter((s) => !hasDependents.has(s.id));

    const subWf: WorkflowDef<Reg, any, any> = {
      _id: wfId,
      input: {} as Input,
      results: {} as Results,
      name: `${id}_pipe`,
      steps: built.steps,
      // steps: built.steps,
      entrySteps,
      endSteps,
      outputResolver: (ctx: any) => {
        return built.frontier.length === 1
          ? ctx[built.frontier[0]]
          : built.frontier.map((f: string) => ctx[f]);
      },
    };

    this.steps.push({
      id,
      action: "__pipe_map__",
      dependsOn: deps,
      when: this.pendingWhen,
      resolve: (ctx: any) => ({
        kind: "pipe_source",
        args: input(ctx),
      }),

      pipe: {
        workflow: subWf,
      },
      options,
    });

    this.frontier = [id];

    return this as any;
  }

  /* ------------------------------------------------ */
  /* Override the result of the last step            */
  /* ------------------------------------------------ */
  as<NewType>(): WorkflowBuilder<
    Reg,
    Services,
    WFReg,
    Input,
    Steps,
    Steps extends [...infer Rest, infer Last]
      ? Last extends StepDef<Reg, infer ID, any>
        ? Simplify<Omit<Results, ID> & { [K in ID]: NewType }>
        : Results
      : Results,
    Output
  > {
    return this as any;
  }

  parallel<
    Branches extends readonly WorkflowBuilder<
      Reg,
      Services,
      WFReg,
      Input,
      any,
      any
    >[],
  >(
    ...branches: {
      [K in keyof Branches]: (
        builder: WorkflowBuilder<Reg, Services, WFReg, Input, [], Results>,
      ) => Branches[K];
    }
  ): WorkflowBuilder<
    Reg,
    Services,
    WFReg,
    Input,
    MergeBranchSteps<Branches, Steps>,
    // [
    //   ...Steps,
    //   ...(Branches[number] extends WorkflowBuilder<Reg, any, any, infer S, any>
    //     ? S
    //     : never),
    // ],
    Simplify<MergeBranchResults<Branches, Results>>
  > {
    const parentFrontier = [...this.frontier];
    const branchEnds: string[] = [];

    branches.forEach((branch) => {
      const b = new WorkflowBuilder<Reg, Services, WFReg, Input, [], Results>(
        this.name,
      );

      b.frontier = parentFrontier;
      b.pendingWhen = this.pendingWhen;
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
  join<ID extends string = string, ActionName extends keyof Reg & string = any>(
    id: ID,
    action: ActionName,
    resolve?: (
      ctx: {
        input: Input;
        results: Results;
      } & Results &
        CallHelpers<Reg, ActionName>,
    ) => NormalizedCall,
    options?: StepOptions<Input, Results>,
  ) {
    const result = this.step<ID, ActionName>(
      id,
      action,
      resolve,
      [...this.frontier],
      options,
    );

    this.clearPendingWhen();
    return result;
  }

  subflow<Prefix extends string, K extends keyof WFReg & string>(
    prefix: Prefix,
    workflowKey: K,
    resolveInput: (ctx: {
      input: Input;
      results: Results;
    }) => WorkflowInput<WFReg[K]>,
    options?: StepOptions<Input, Results>,
  ): WorkflowBuilder<
    Reg,
    Services,
    WFReg,
    Input,
    Steps,
    Results & { [P in Prefix]: WorkflowOutput<WFReg[K]> }
  > {
    this.steps.push({
      id: prefix,
      action: "__subflow__",
      dependsOn: [...this.frontier],
      when: this.pendingWhen,
      resolve: (ctx: any) => resolveInput(ctx),
      options,
      __subflowId: workflowKey, // 👈 STRING ONLY
    });

    this.frontier = [prefix];
    return this as any;
  }

  private _subflow = this.subflow.bind(this);
  sub = ((...args: Parameters<typeof this._subflow>) =>
    this._subflow(...args)) as this["subflow"];

  /* ------------------------------------------------ */
  /* Conditional                                      */
  /* ------------------------------------------------ */

  when(
    predicate: (ctx: { input: Input; results: Results } & Results) => boolean,
  ): WorkflowBuilder<Reg, Services, WFReg, Input, Steps, Results, Output> {
    this.pendingWhen = predicate;
    return this;
  }

  endWhen(): this {
    this.clearPendingWhen();

    return this;
  }

  /* ------------------------------------------------ */
  /* Workflow output                                  */
  /* ------------------------------------------------ */
  output<Output>(
    fn: (ctx: { input: Input; results: Results } & Results) => Output,
  ): WorkflowDef<Reg, Input, Results, Steps, Output> {
    this.outputResolver = fn;
    return this.build() as WorkflowDef<Reg, Input, Results, Steps, Output>;
  }

  build(): WorkflowDef<Reg, Input, Results, Steps> {
    this.validateDependencies();

    return {
      _id: generateWorkflowId(this.name),
      name: this.name,
      steps: this.steps as Steps,
      entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
      endSteps: this.getEndSteps(),
      input: {} as Input,
      results: {} as Results,
      outputResolver: this.outputResolver,
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

export function createWorkflow<
  Reg extends ActionRegistry,
  WFReg extends Record<string, WorkflowDef<any, any, any, any, any>>, // 👈 NEW
  Services extends ServiceRegistry,
>() {
  return function workflow<Input = unknown>(name: string) {
    return new WorkflowBuilder<Reg, Services, WFReg, Input>(name);
  };
}

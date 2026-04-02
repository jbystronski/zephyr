import {
  ActionRegistry,
  ActionReturn,
  CallHelpers,
  NormalizedCall,
  ServiceParams,
  ServiceRegistry,
  ServiceReturn,
} from "./types.js";

type PipeStep = {
  type: "action" | "service";
  action?: string;
  service?: string;
  method?: string;
  resolve: (ctx: any) => NormalizedCall;
};

export type PipeDef = {
  input: (ctx: any) => any[];
  steps: PipeStep[];
};
type InferStepReturn<
  Step,
  Reg extends ActionRegistry,
  Services extends ServiceRegistry,
> = Step extends { type: "action"; action: infer A }
  ? A extends keyof Reg
    ? ActionReturn<Reg, A>
    : never
  : Step extends { type: "service"; service: infer SK; method: infer MK }
    ? SK extends keyof Services
      ? MK extends keyof Services[SK]
        ? ServiceReturn<Services, SK, MK>
        : never
      : never
    : never;
export type PipeFinalType<
  Steps,
  Reg extends ActionRegistry,
  Services extends ServiceRegistry,
> = Steps extends [...any[], infer Last]
  ? InferStepReturn<Last, Reg, Services>
  : never;

export type StepsOfPipeBuilder<PB> =
  PB extends PipeBuilder<any, any, any, any, infer S> ? S : never;

export class PipeBuilder<
  Current,
  Reg extends ActionRegistry,
  Services extends ServiceRegistry,
  Results,
  Steps extends any[] = [],
> {
  private steps: PipeStep[] = [];

  action<A extends keyof Reg & string>(
    action: A,
    resolve: (
      ctx: {
        current: Current;
        results: Results;
      } & CallHelpers<Reg, A>,
    ) => NormalizedCall,
  ): PipeBuilder<
    ActionReturn<Reg, A>,
    Reg,
    Services,
    Results,
    [...Steps, { type: "action"; action: A }]
  > {
    this.steps.push({
      type: "action",
      action,
      resolve,
    });

    return this as any;
  }

  service<
    SK extends keyof Services & string,
    MK extends keyof Services[SK] & string,
  >(
    id: string,
    service: SK,
    method: MK,
    resolve: (
      ctx: { current: Current; results: Results } & {
        args: (...args: ServiceParams<Services, SK, MK>) => {
          kind: "positional";
          args: ServiceParams<Services, SK, MK>;
        };
        obj: ServiceParams<Services, SK, MK> extends [infer A]
          ? (arg: A) => { kind: "object"; args: A }
          : never;
        none: () => { kind: "none" };
        loop: (
          items:
            | { kind: "positional"; args: ServiceParams<Services, SK, MK> }[]
            | { kind: "object"; args: ServiceParams<Services, SK, MK>[0] }[],
        ) => {
          kind: "loop";
          items: typeof items;
        };
      },
    ) => NormalizedCall,
  ): PipeBuilder<
    ServiceReturn<Services, SK, MK>,
    Reg,
    Services,
    Results,
    [...Steps, { type: "service"; service: SK; method: MK }]
  > {
    this.steps.push({
      type: "service",
      service,
      method,
      resolve,
    });

    return this as any;
  }

  getSteps(): Steps {
    return this.steps as any;
  }

  build() {
    return this.steps;
  }
}

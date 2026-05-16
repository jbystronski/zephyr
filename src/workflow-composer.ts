import {
  createExprCtx,
  ExprCtx,
  ExprNode,
  remapWorkflowInstance,
  toNode,
} from "./ast.js";
import { ServiceRegistry, Simplify } from "./types.js";
import { generateWorkflowId } from "./utils.js";

type WorkflowInput<T> =
  T extends WorkflowDef<infer I, any, any, any> ? I : never;

// type WorkflowOutput<T> =
//   T extends WorkflowDef<any, any, any, any, infer O> ? O : never;

type WorkflowOutput<T> =
  T extends WorkflowDef<any, any, any, infer O>
    ? unknown extends O
      ? undefined
      : O
    : undefined;

export type PipeNode = {
  type: "pipe";
  input: ExprNode;
  mode: PipeMode;
  steps: StepDef<any>[];

  // workflow: {
  //   _id: string;
  //   name: string;
  //
  //   steps: StepDef<any>[];
  //
  //   //TODO: add guards here?
  //   // guards: number[]
  //   entrySteps: StepDef<any>[];
  //   endSteps: StepDef<any>[];
  //
  //   aliasMap: {
  //     results: Record<string, string>;
  //   };
  // };

  entryMap: Record<string, string>;
  exitMap: number[];
};

export type StepSpec =
  | "__init__"
  | "__eval__"
  | "__out__"
  | "__pipe__"
  | "__join__";

export type WFConfig<Input, Services, WFReg> = {
  input: Input;
  services: Services;
  wfReg: WFReg;
};

export type StepDef<ID extends string = string> = {
  id: ID;
  idx: number;
  dependsOn: number[];
  guards?: number[];
  resolve: ExprNode | null;

  options?: StepOptions<any>;
  spec?: StepSpec;
  pipe?: PipeNode;
};

export type WorkflowDef<
  Input,
  Results,
  Steps extends StepDef<any>[] = StepDef<any>[],
  Output = undefined,
> = {
  name: string;
  _id: string;
  steps: Steps;
  entrySteps: StepDef<any>[];
  endSteps: StepDef<any>[];
  input: Input;
  results: Results;
  outputIdx?: number;
  initIdx?: number;
  guards: number[];
  aliasMap: {
    results: Record<string, string>;
  };
};
type StepRuntimeCtx<R> = {
  results: R;
};
type StepOptions<Results> = {
  retry?: number;
  retryDelay?: number | ((attempt: number) => number);
  timeout?: number;

  continueOnError?: boolean;

  onError?: (err: unknown, ctx: StepRuntimeCtx<Results>) => any;
  pipe?: {
    parallel?: boolean;
  };

  // optional later:
  label?: string;
  meta?: Record<string, any>;
};

type MergeBranchResults<
  Branches extends readonly any[],
  Acc,
> = Branches extends readonly [infer Head, ...infer Tail]
  ? MergeBranchResults<
      Tail,
      Acc &
        (Head extends WorkflowBuilder<any, any, infer Results> ? Results : {})
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
        ...(Head extends WorkflowBuilder<any, infer Steps, any> ? Steps : []),
      ]
    >
  : Acc;

type PipeMode = "map" | "filter" | "find" | "some" | "every" | "count";

type PipeResult<Mode extends PipeMode, Item> = Mode extends "map"
  ? Item[]
  : Mode extends "filter"
    ? Item[]
    : Mode extends "find"
      ? Item | undefined
      : Mode extends "some" | "every"
        ? boolean
        : Mode extends "count"
          ? number
          : never;

export class WorkflowBuilder<
  Config extends WFConfig<
    unknown,
    ServiceRegistry,
    Record<string, WorkflowDef<any, any, any, any>>
  >,
  Steps extends StepDef<any>[] = [],
  Results = {},
  CurrentIds extends string = never,
  Output = undefined,
> {
  private steps: StepDef<any>[] = [];
  private guards: number[] = [];

  private frontier: number[] = [];
  private idToIdx: Record<string, number> = {};
  private idx = 0;
  private initIdx? = 0;
  private outputIdx?: number;

  constructor(
    private name: string,
    private wfRegistry?: Config["wfReg"],
  ) {}

  init<ID extends string>(id: ID) {
    if (this.initIdx && this.initIdx > 0) {
      throw Error(`Only one "init" call per workflow is allowed`);
    }

    if (this.steps.length > 0) {
      throw Error("init must be the first step");
    }

    this.steps.push({
      id,
      idx: this.idx,
      spec: "__init__",
      guards: [...(this.guards ?? [])],
      resolve: null,
      dependsOn: [],
    });

    this.frontier = [this.idx];
    this.initIdx = this.idx;
    this.idToIdx[id] = this.idx;

    this.idx += 1;

    return this as WorkflowBuilder<
      Config,
      Steps,
      Simplify<Results & { [K in ID]: Config["input"] }>,
      ID
    >;
  }

  seq<ID extends string, R>(
    id: ID,

    resolve?: (ctx: ExprCtx<Config["services"], Results>) => R,

    options?: StepOptions<Results>,
  ): WorkflowBuilder<
    Config,
    [...Steps, StepDef<ID>],
    Simplify<
      Results & {
        [K in ID]: Awaited<R>;
      }
    >,
    ID
  > {
    const deps = [...this.frontier];

    this.idToIdx[id] = this.idx;

    const expr = resolve ? resolve(createExprCtx(this.idToIdx)) : [];
    const ast = toNode(expr);

    this.steps.push({
      id,
      idx: this.idx,
      resolve: ast,
      dependsOn: deps,
      guards: [...(this.guards ?? [])],
      options,
    });

    this.frontier = [this.idx];

    this.idx += 1;
    return this as any;
  }

  pipe<
    ID extends string,
    Mode extends PipeMode,
    Arr extends any[],
    Branch extends WorkflowBuilder<
      WFConfig<Arr[number], Config["services"], Config["wfReg"]>,
      any,
      any,
      any
    >,
  >(
    id: ID,
    mode: Mode,
    input: (ctx: ExprCtx<Config["services"], Results>) => Arr,

    builder: (
      b: WorkflowBuilder<
        WFConfig<Arr[number], Config["services"], Config["wfReg"]>,
        [],
        Results
      >,
    ) => Branch,
    options?: StepOptions<Results>,
  ): WorkflowBuilder<
    Config,
    Steps,
    Simplify<
      Results & {
        [K in ID]: PipeResult<Mode, Arr[number]>;
      }
    >,
    ID
  > {
    const deps = [...this.frontier];

    const branchBuilder = new WorkflowBuilder<
      WFConfig<Arr[number], Config["services"], Config["wfReg"]>,
      [],
      Results
    >(this.name, this.wfRegistry);

    branchBuilder.idx = this.idx;
    branchBuilder.frontier = [];

    branchBuilder.guards = [...(this.guards ?? [])];

    branchBuilder.idToIdx = this.idToIdx;

    const built = builder(branchBuilder);

    const wfId = generateWorkflowId(id);

    const entrySteps = built.steps.filter((s) => s.dependsOn.length === 0);

    const hasDependents = new Set<number>();
    for (const step of built.steps) {
      for (const dep of step.dependsOn) hasDependents.add(dep);
    }
    // const endSteps = built.steps.filter((s) => !hasDependents.has(s.uid));

    const endSteps = built.steps.filter(
      (s) => s.spec !== "__init__" && !hasDependents.has(s.idx),
    );

    const pipeExpr = input ? input(createExprCtx(this.idToIdx)) : [];

    const pipeInputAst = toNode(pipeExpr);

    const subWf: WorkflowDef<any, any, any, any> = {
      _id: wfId,
      guards: built.guards,

      input: { type: "pipe_input", value: pipeInputAst },
      results: {} as Results,
      name: `${id}_pipe`,
      steps: built.steps,

      aliasMap: {
        results: Object.fromEntries(built.steps.map((s) => [s.id, s.idx])),
      },

      entrySteps,
      endSteps,
    };

    this.idx = built.idx;

    this.idToIdx[id] = this.idx;

    this.steps.push({
      id,
      idx: this.idx,
      spec: "__pipe__",
      dependsOn: deps,
      guards: [...(this.guards ?? [])],

      resolve: pipeInputAst,
      pipe: {
        type: "pipe",
        mode,

        input: pipeInputAst,
        steps: subWf.steps,
        entryMap: Object.fromEntries(entrySteps.map((s) => [s.id, s.idx])),
        exitMap: endSteps.map((s) => s.idx),
      },
      options,
    });

    this.frontier = [this.idx];

    this.idx += 1;

    return this as any;
  }

  as<NewType>(): WorkflowBuilder<
    Config,
    Steps,
    Simplify<{
      [K in keyof Results]: K extends CurrentIds ? NewType : Results[K];
    }>,
    CurrentIds,
    Output
  > {
    return this as any;
  }

  parallel<Branches extends readonly WorkflowBuilder<Config, any, any>[]>(
    ...branches: {
      [K in keyof Branches]: (
        builder: WorkflowBuilder<Config, [], Results>,
      ) => Branches[K];
    }
  ): WorkflowBuilder<
    Config,
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
    let currentIdx = this.idx;
    const branchEnds: number[] = [];
    const mergedIdMap = { ...this.idToIdx };

    branches.forEach((branch) => {
      const b = new WorkflowBuilder<Config, [], Results>(
        this.name,

        this.wfRegistry,
      );

      b.guards = [...(this.guards ?? [])];
      b.frontier = parentFrontier;

      b.idToIdx = { ...this.idToIdx };
      b.idx = currentIdx;
      const built = branch(b);
      currentIdx = built.idx;
      branchEnds.push(...b.frontier);

      this.steps.push(...(b as any).steps);

      Object.assign(mergedIdMap, built.idToIdx);
    });
    this.idx = currentIdx;
    this.frontier = branchEnds;
    this.idToIdx = mergedIdMap;

    return this as any;
  }

  join() {
    this.steps.push({
      id: "__join__",
      idx: this.idx,
      resolve: null,
      spec: "__join__",
      dependsOn: [...this.frontier],
      guards: [...(this.guards ?? [])],
    });

    this.frontier = [this.idx];

    this.idx += 1;

    return this as any as WorkflowBuilder<Config, Steps, Results>;
  }

  subflow<Prefix extends string, K extends keyof Config["wfReg"] & string>(
    prefix: Prefix,
    workflowKey: K,
    resolve?: (
      ctx: ExprCtx<Config["services"], Results>,
    ) => WorkflowInput<Config["wfReg"][K]>,
  ): WorkflowBuilder<
    Config,
    Steps,
    Results & { [P in Prefix]: WorkflowOutput<Config["wfReg"][K]> },
    Prefix
  > {
    const subWf = this.wfRegistry?.[workflowKey] as WorkflowDef<
      any,
      any,
      any,
      any
    >;

    if (!subWf) {
      throw new Error(`Subflow not found: ${workflowKey}`);
    }
    const expr = resolve ? resolve(createExprCtx(this.idToIdx)) : [];
    const ast = toNode(expr);

    const { wf, maxIdx, outputIdx } = remapWorkflowInstance(
      subWf,
      prefix,
      ast,
      this.frontier,
      this.idx,
    );

    this.idToIdx[prefix] = outputIdx;

    // this.steps.push(...wf.steps);

    this.steps.push(
      ...wf.steps.map((s: any) => ({
        ...s,
        guards: [...(this.guards ?? []), ...(s.guards ?? [])],
      })),
    );

    if (outputIdx !== undefined) {
      this.frontier = [outputIdx];
    } else {
      this.frontier = wf.endSteps.map((s: any) => s.idx);
    }

    this.idx = maxIdx + 1;

    return this as any;
  }

  private _subflow = this.subflow.bind(this);
  sub = ((...args: Parameters<typeof this._subflow>) =>
    this._subflow(...args)) as this["subflow"];

  private _parallel = this.parallel.bind(this);
  par = ((...args: Parameters<typeof this._parallel>) =>
    this._parallel(...args)) as this["parallel"];

  if<ID extends string, R, Branch extends WorkflowBuilder<Config, any, any>>(
    id: ID,
    resolve: (ctx: ExprCtx<Config["services"], Results>) => R,

    builder: (b: WorkflowBuilder<Config, [], Results>) => Branch,
  ): WorkflowBuilder<
    Config,
    [
      ...Steps,
      ...(Branch extends WorkflowBuilder<Config, infer S, any> ? S : []),
    ],
    Simplify<
      Results &
        (Branch extends WorkflowBuilder<Config, any, infer R> ? Partial<R> : {})
    >,
    any,
    Output
  > {
    this.seq(id, resolve);

    const newGuardIdx = this.idx - 1;

    const newGuards = [...(this.guards ?? []), newGuardIdx];

    const b = new WorkflowBuilder<Config, [], Results>(
      this.name,

      this.wfRegistry,
    );

    b.frontier = [newGuardIdx];
    b.guards = [...newGuards];
    b.idx = this.idx;

    b.idToIdx = { ...this.idToIdx };

    const built = builder(b);

    this.steps.push(...b.steps);
    this.frontier = [...b.frontier];

    this.idToIdx = {
      ...this.idToIdx,
      ...built.idToIdx,
    };
    this.idx = built.idx;

    return this as any;
  }

  output<R>(
    resolve: (ctx: ExprCtx<Config["services"], Results>) => R,
  ): WorkflowDef<Config["input"], Results, Steps, R> {
    this.idToIdx["__output__"] = this.idx;
    const expr = resolve ? resolve(createExprCtx(this.idToIdx)) : [];
    const ast = toNode(expr);

    this.outputIdx = this.idx;

    this.steps.push({
      id: "__output__",
      idx: this.idx,
      spec: "__out__",
      dependsOn: [...this.frontier],

      // guards: [...(this.guards ?? [])],

      resolve: ast,
    });

    this.idx += 1;

    return this.build() as WorkflowDef<Config["input"], Results, Steps, Output>;
  }

  build(): WorkflowDef<Config["input"], Results, Steps> {
    this.validateDependencies();

    return {
      _id: generateWorkflowId(this.name),
      name: this.name,

      steps: this.steps as Steps,
      entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
      endSteps: this.getEndSteps(),

      guards: this.guards,
      outputIdx: this.outputIdx,
      initIdx: this.initIdx,
      input: {} as Config["input"],
      results: {} as Results,
      aliasMap: {
        results: Object.fromEntries(this.steps.map((s) => [s.id, s.idx])),
      },
    };
  }

  private validateDependencies() {
    const stepIds = new Set(this.steps.map((s) => s.idx));

    for (const step of this.steps) {
      for (const dep of step.dependsOn) {
        if (!stepIds.has(dep))
          throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
      }
    }
  }

  private getEndSteps() {
    const hasDependents = new Set<number>();
    for (const step of this.steps) {
      for (const dep of step.dependsOn) hasDependents.add(dep);
    }
    return this.steps.filter((s) => !hasDependents.has(s.idx));
  }
}

export function createWorkflow<
  WFReg extends Record<string, WorkflowDef<any, any, any, any>>,
  Shared extends ServiceRegistry,
>(wfRegistry?: WFReg) {
  return function workflow<Input = unknown>(name: string) {
    return new WorkflowBuilder<WFConfig<Input, Shared, WFReg>>(
      name,
      wfRegistry,
    );
  };
}

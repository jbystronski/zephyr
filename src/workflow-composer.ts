import {
  ArgNode,
  ConditionNode,
  createGetter,
  createOutputCtx,
  createWhenCtx,
  remapWorkflowInstance,
  toNode,
} from "./ast.js";
import {
  ServiceParams,
  ServiceRegistry,
  ServiceReturn,
  Simplify,
} from "./types.js";
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

type ConditionResolveCtx<Results> = {
  get<K extends keyof Results>(key: K): Results[K];
  eq: (a: any, b: any) => ConditionNode;
  neq: (a: any, b: any) => ConditionNode;

  gt: (a: any, b: any) => ConditionNode;
  gte: (a: any, b: any) => ConditionNode;
  lt: (a: any, b: any) => ConditionNode;
  lte: (a: any, b: any) => ConditionNode;

  and: (...conds: ConditionNode[]) => ConditionNode;
  or: (...conds: ConditionNode[]) => ConditionNode;
  not: (cond: ConditionNode) => ConditionNode;

  truthy: (v: any) => ConditionNode;
  falsy: (v: any) => ConditionNode;
};

export type PipeNode = {
  type: "pipe";
  input: ArgNode;
  mode: PipeMode;

  workflow: {
    _id: string;
    name: string;

    steps: StepDef<any>[];

    //TODO: add guards here?
    // guards: number[]
    entrySteps: StepDef<any>[];
    endSteps: StepDef<any>[];

    aliasMap: {
      results: Record<string, string>;
    };
  };

  entryMap: Record<string, string>;
  exitMap: number[];
};

export type WFConfig<Input, Services, WFReg> = {
  input: Input;
  services: Services;
  wfReg: WFReg;
};

export type StepDef<ID extends string = string> = {
  id: ID;
  idx: number;

  service?: string;
  method: string;
  dependsOn: number[];
  guards?: number[];
  resolve?: ArgNode[];
  eval?: ConditionNode;

  options?: StepOptions<any>;

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
      method: "__init__",
      guards: [...(this.guards ?? [])],
      resolve: [],
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

  seq<
    ID extends string,
    SK extends keyof Config["services"] & string,
    MK extends keyof Config["services"][SK] & string,
  >(
    id: ID,
    service: SK,
    method: MK,

    resolve?: (
      ctx: {
        get<K extends keyof Results>(key: K): Results[K];
      } & {
        args: <T extends ServiceParams<Config["services"], SK, MK>>(
          ...args: T
        ) => T;
      },
    ) => ServiceParams<Config["services"], SK, MK>,

    options?: StepOptions<Results>,
  ): WorkflowBuilder<
    Config,
    [...Steps, StepDef<ID>],
    Simplify<
      Results & {
        [K in ID]: ServiceReturn<Config["services"], SK, MK>;
      }
    >,
    ID
  > {
    const deps = [...this.frontier];

    this.idToIdx[id] = this.idx;
    const astArgs: ArgNode[] = resolve
      ? resolve({
          get: ((key: string) =>
            createGetter(this.idToIdx[key] ?? this.idx)) as any,

          args: (...args: any[]) => args as any,
        }).map(toNode)
      : [];

    this.steps.push({
      id,
      idx: this.idx,
      method,
      service,
      resolve: astArgs,
      dependsOn: deps,
      guards: [...(this.guards ?? [])],
      options,
    });

    this.frontier = [this.idx];

    this.idx += 1;
    return this as any;
  }

  eval<ID extends string>(
    id: ID,
    resolve: (ctx: ConditionResolveCtx<Results>) => ConditionNode,
  ): WorkflowBuilder<
    Config,
    [...Steps, StepDef<ID>],
    Simplify<
      Results & {
        [K in ID]: boolean;
      }
    >,
    ID
  > {
    const deps = [...this.frontier];

    this.idToIdx[id] = this.idx;

    const ast = resolve(createWhenCtx(this.idToIdx) as any);
    // const astArgs: ArgNode[] = resolve
    //   ? resolve({
    //       get: ((key: string) => createGetter(key)) as any,
    //     }).map(toNode)
    //   : [];

    this.steps.push({
      id,
      idx: this.idx,
      method: "__eval__",
      eval: ast,
      dependsOn: deps,
      guards: [...(this.guards ?? [])],
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

    input: (ctx: { get<K extends keyof Results>(key: K): Results[K] }) => Arr,
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
      (s) => s.method !== "__init__" && !hasDependents.has(s.idx),
    );

    const pipeInputAst = toNode(
      input({
        get: ((key: string) => {
          const idx = this.idToIdx[key];
          if (idx === undefined) throw new Error(`Unresolved idx`);
          return createGetter(idx);
        }) as any,
      }),
    );

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
      method: "__pipe__",
      dependsOn: deps,
      guards: [...(this.guards ?? [])],

      resolve: [pipeInputAst],
      pipe: {
        type: "pipe",
        mode,
        workflow: subWf,
        input: pipeInputAst,
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
      resolve: [],
      method: "__join__",
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
    resolveInput?: (ctx: {
      get<K extends keyof Results>(key: K): Results[K];
    }) => WorkflowInput<Config["wfReg"][K]>,
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

    const inputAst = toNode(
      resolveInput?.({
        get: ((k: string) => createGetter(this.idToIdx[k] ?? this.idx)) as any,
      }),
    );

    const { wf, maxIdx, outputIdx } = remapWorkflowInstance(
      subWf,
      prefix,
      inputAst,
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

  if<ID extends string, Branch extends WorkflowBuilder<Config, any, any>>(
    id: ID,
    predicate: (ctx: ConditionResolveCtx<Results>) => ConditionNode,

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
    // const ast = predicate(createWhenCtx(this.idToIdx) as any);
    // const deps = [...this.frontier];
    //
    // this.idToIdx[id] = this.idx;
    // this.steps.push({
    //   id,
    //   idx: this.idx,
    //   method: "__eval__",
    //   eval: ast,
    //   dependsOn: deps,
    //   guards: [...(this.guards ?? [])],
    // });

    this.eval(id, predicate);

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

  ifElse<
    ID extends string,
    IfBranch extends WorkflowBuilder<Config, any, any>,
    ElseBranch extends WorkflowBuilder<Config, any, any>,
  >(
    id: ID,
    predicate: (ctx: ConditionResolveCtx<Results>) => ConditionNode,
    ifBuilder: (b: WorkflowBuilder<Config, [], Results>) => IfBranch,
    elseBuilder: (b: WorkflowBuilder<Config, [], Results>) => ElseBranch,
  ): WorkflowBuilder<
    Config,
    [
      ...Steps,
      ...(IfBranch extends WorkflowBuilder<any, infer S, any> ? S : []),
      ...(ElseBranch extends WorkflowBuilder<any, infer S, any> ? S : []),
    ],
    Simplify<
      Results &
        (IfBranch extends WorkflowBuilder<any, any, infer R1>
          ? Partial<R1>
          : {}) &
        (ElseBranch extends WorkflowBuilder<any, any, infer R2>
          ? Partial<R2>
          : {})
    >,
    any,
    Output
  > {
    const cond = predicate(createWhenCtx(this.idToIdx) as any);

    const guardIdx = this.idx;
    this.eval(id, () => cond);

    // IF branch
    const ifB = new WorkflowBuilder<Config, [], Results>(
      this.name,

      this.wfRegistry,
    );
    ifB.frontier = [guardIdx];
    ifB.guards = [...(this.guards ?? []), guardIdx];
    ifB.idToIdx = { ...this.idToIdx };
    ifB.idx = this.idx;

    const builtIf = ifBuilder(ifB);

    // ELSE branch (negated condition)

    const elseIdx = builtIf.idx;

    // const base = this.steps[guardIdx];
    this.steps.push({
      id: `${id}__else__`,
      idx: elseIdx,
      method: "__eval__",
      eval: {
        type: "not",
        condition: JSON.parse(JSON.stringify(cond)),
      },
      dependsOn: [guardIdx],
      guards: [...(this.guards ?? [])],
    });

    const elseB = new WorkflowBuilder<Config, [], Results>(
      this.name,

      this.wfRegistry,
    );

    elseB.frontier = [elseIdx];
    elseB.guards = [...(this.guards ?? []), elseIdx];
    elseB.idToIdx = { ...this.idToIdx };
    elseB.idx = elseIdx + 1;

    const builtElse = elseBuilder(elseB);

    // merge
    this.steps.push(...ifB.steps, ...elseB.steps);

    this.idToIdx = {
      ...this.idToIdx,
      ...ifB.idToIdx,
      ...elseB.idToIdx,
    };

    // both branches become frontier
    this.frontier = [...ifB.frontier, ...elseB.frontier];
    this.idx = builtElse.idx;
    return this as any;
  }

  output<Output>(
    fn: (ctx: { get<K extends keyof Results>(key: K): Results[K] }) => Output,
  ): WorkflowDef<Config["input"], Results, Steps, Output> {
    this.idToIdx["__output__"] = this.idx;

    const ctx = createOutputCtx(this.idToIdx);

    const resolved = fn(ctx);

    const astNode: ArgNode = toNode(resolved);

    this.outputIdx = this.idx;

    this.steps.push({
      id: "__output__",
      idx: this.idx,
      method: "__output__",
      dependsOn: [...this.frontier],

      // guards: [...(this.guards ?? [])],

      resolve: [astNode],
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

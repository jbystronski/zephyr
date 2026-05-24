import { createExprCtx, remapWorkflowInstance, toExpr } from "./ast.js";
import type {
  ExprCtx,
  PipeMode,
  PipeResult,
  ServiceRegistry,
  Simplify,
  StepDef,
  StepOptions,
  WFConfig,
  WorkflowDef,
  WorkflowInput,
  WorkflowOutput,
} from "./types.js";
import { generateWorkflowId } from "./utils.js";

// type WorkflowOutput<T> =
//   T extends WorkflowDef<any, any, any, any, infer O> ? O : never;

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

type NewType<Results> = StepOptions<Results>;

export class WorkflowBuilder<
  Config extends WFConfig<unknown, ServiceRegistry>,
  Steps extends StepDef<any>[] = [],
  Results = {},
  CurrentIds extends string = never,
  Output = undefined,
> {
  private steps: StepDef<any>[] = [];
  private guards: number[] = [];
  private __id = generateWorkflowId(this.name);

  private frontier: number[] = [];
  private idToIdx: Record<string, number> = {};
  private idx = 0;
  private initIdx?: number | undefined = undefined;
  private outputIdx?: number;
  private inlineStack: string[] = [];

  constructor(private name: string) {
    this.inlineStack.push(this.__id);
  }

  get id() {
    return this.__id;
  }

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

    options?: NewType<Results>,
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

    const expr = resolve ? resolve(createExprCtx(this.idToIdx)) : null;

    const ast = expr != null ? toExpr(expr) : null;

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
      WFConfig<Arr[number], Config["services"]>,
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
        WFConfig<Arr[number], Config["services"]>,
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
      WFConfig<Arr[number], Config["services"]>,
      [],
      Results
    >(this.name);

    branchBuilder.idx = this.idx;
    branchBuilder.frontier = [];

    branchBuilder.guards = [...(this.guards ?? [])];

    branchBuilder.idToIdx = this.idToIdx;

    const built = builder(branchBuilder);

    const wfId = generateWorkflowId(id);

    // const entrySteps = built.steps.filter((s) => s.dependsOn.length === 0);

    const hasDependents = new Set<number>();
    for (const step of built.steps) {
      for (const dep of step.dependsOn) hasDependents.add(dep);
    }
    // const endSteps = built.steps.filter((s) => !hasDependents.has(s.uid));

    const endSteps = built.steps.filter(
      (s) => s.spec !== "__init__" && !hasDependents.has(s.idx),
    );

    const pipeExpr = input ? input(createExprCtx(this.idToIdx)) : [];

    const pipeInputAst = pipeExpr != null ? toExpr(pipeExpr) : null;

    const subWf: WorkflowDef<any, any> = {
      __id: wfId,
      guards: built.guards,

      // input: { type: "pipe_input", value: pipeInputAst },
      // results: {} as Results,
      // name: `${id}_pipe`,
      steps: built.steps,
      initIdx: built.initIdx,

      // aliasMap: {
      //   results: Object.fromEntries(built.steps.map((s) => [s.id, s.idx])),
      // },

      // entrySteps,
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
        mode,

        // input: pipeInputAst,
        workflow: subWf,

        // entryMap: Object.fromEntries(entrySteps.map((s) => [s.id, s.idx])),
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
      const b = new WorkflowBuilder<Config, [], Results>(this.name);

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

  subflow<Prefix extends string, SF extends WorkflowDef<any, any>>(
    prefix: Prefix,
    sf: SF,
    resolve?: (ctx: ExprCtx<Config["services"], Results>) => WorkflowInput<SF>,
  ): WorkflowBuilder<
    Config,
    Steps,
    Results & { [P in Prefix]: WorkflowOutput<SF> },
    Prefix
  > {
    if (!sf) {
      throw new Error(`Subflow not found`);
    }

    const targetId = (sf as any).__id;

    if (!targetId) {
      throw new Error("Invalid subflow: missing id");
    }

    // ❗ CYCLE CHECK
    if (this.inlineStack.includes(targetId)) {
      throw new Error(
        `Cycle detected: ${this.inlineStack.join(" -> ")} -> ${targetId}`,
      );
    }

    this.inlineStack.push(targetId);
    this.inlineStack = [...new Set(this.inlineStack)];

    const expr = resolve ? resolve(createExprCtx(this.idToIdx)) : null;

    const ast = expr != null ? toExpr(expr) : null;

    const { wf, maxIdx, outputIdx } = remapWorkflowInstance(
      sf,
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

    const b = new WorkflowBuilder<Config, [], Results>(this.name);

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
  ): WorkflowDef<Config["input"], R> {
    const id = `${this.name}_out`;
    this.idToIdx[id] = this.idx;
    // const expr = resolve ? resolve(createExprCtx(this.idToIdx)) : [];
    // const ast = toNode(expr);

    const expr = resolve ? resolve(createExprCtx(this.idToIdx)) : null;

    const ast = expr != null ? toExpr(expr) : null;

    this.outputIdx = this.idx;

    this.steps.push({
      id,
      idx: this.idx,
      dependsOn: [...this.frontier],

      // guards: [...(this.guards ?? [])],

      resolve: ast,
    });

    this.idx += 1;

    return this.build() as WorkflowDef<Config["input"], Output>;
  }

  build(): WorkflowDef<Config["input"]> {
    this.validateDependencies();

    return {
      __id: this.id,
      name: this.name,

      steps: this.steps as Steps,
      // entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
      endSteps: this.getEndSteps(),

      guards: this.guards,
      outputIdx: this.outputIdx,
      initIdx: this.initIdx,
      // input: {} as Config["input"],
      // results: {} as Results,
      // aliasMap: {
      //   results: Object.fromEntries(this.steps.map((s) => [s.id, s.idx])),
      // },
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

// export function createWorkflow<
//   Shared extends ServiceRegistry,
//   WFReg extends Record<string, WorkflowDef<any, any, any, any>>,
// >(wfRegistry?: WFReg) {
//   return function workflow<Input = unknown>(name: string) {
//     return new WorkflowBuilder<WFConfig<Input, Shared, WFReg>>(
//       name,
//       wfRegistry,
//     );
//   };
// }

export function createWorkflow<Shared extends ServiceRegistry>() {
  return function workflow<Input = unknown>(name: string) {
    return new WorkflowBuilder<WFConfig<Input, Shared>>(name);
  };
}

// export function createWorkflow<
//   S extends ServiceRegistry,
//   I extends IndexShape,
//   A extends Record<string, string>,
// >(access: {
//   get<AKey extends keyof A, W extends keyof I[A[AKey]]>(
//     alias: AKey,
//     wf: W,
//   ): I[A[AKey]][W];
// }) {
//   return function workflow<Input = unknown>(name: string) {
//     return new WorkflowBuilder<WFConfig<Input, S, WFReg<I, A>>>(name, access);
//   };
// }
export { StepDef, WorkflowDef };

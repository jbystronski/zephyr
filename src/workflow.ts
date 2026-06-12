import {
  CallExpr,
  Expr,
  PipeMode,
  Primitive,
  RefExpr,
  StepDef,
  StepOptions,
  WorkflowDef,
  WorkflowInput,
  WorkflowOutput,
} from "./types.js";
import { uniqueId } from "./utils.js";

type StepSchema = Record<string, any>;

type ServiceRegistry = Record<string, any>;

type StepRefs<S extends StepSchema> = { [K in keyof S]: S[K] } & Record<
  string,
  any
>;

type WorkflowCtx<SR extends ServiceRegistry, Schema extends StepSchema> = SR & {
  steps: StepRefs<Schema>;

  IF: <T>(cond: boolean, value: T) => boolean;

  SUB: <T extends WorkflowDef<any, any>>(
    wf: T,
    input?: WorkflowInput<T>,
  ) => WorkflowOutput<T>;

  PIPE: <T>(mode: PipeMode, iterable: any[], input: any, value: any) => T;
};

type WorkflowShape<Schema extends StepSchema> = {
  [key: string]: any;
  __meta?: Partial<Record<keyof Schema, StepOptions>>;
};

export function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
}

export function isRefExpr(v: any): v is RefExpr {
  return v && typeof v === "object" && typeof v.__ref === "number";
}

export function isCallExpr(v: any): v is CallExpr {
  return (
    v &&
    typeof v === "object" &&
    typeof v.__service === "string" &&
    typeof v.__method === "string"
  );
}

export function isPrimitive(v: any): v is Primitive {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

export function expr(expr: Expr): any {
  return createExprProxy({
    __expr: expr,
    __path: [],
  });
}

function extractDeps(expr: any, out = new Set<number>()) {
  if (!expr || typeof expr !== "object") return out;

  if (Array.isArray(expr)) {
    for (const v of expr) extractDeps(v, out);
    return out;
  }

  if (expr.__ref !== undefined) {
    out.add(expr.__ref);
    return out;
  }

  for (const k in expr) {
    extractDeps(expr[k], out);
  }

  return out;
}

function unwrapExpr(v: any): Expr {
  if (v && typeof v === "object" && "__expr" in v) {
    return v.__expr;
  }

  return toExpr(v);
}

export function toExpr(v: any): Expr {
  if (v && typeof v === "object" && "__expr" in v) {
    return v.__expr;
  }

  if (isPipeExpr(v) || isSubflowExpr(v) || isIfExpr(v)) {
    return v;
  }

  if (isPrimitive(v)) {
    return v;
  }

  if (Array.isArray(v)) {
    return v.map(toExpr);
  }

  if (isPlainObject(v)) {
    const out: Record<string, Expr> = {};

    for (const k in v) {
      out[k] = toExpr(v[k]);
    }

    return out;
  }

  throw new Error(`Unsupported expr value: ${v}`);
}

export function createExprProxy(node: {
  __expr: Expr;
  __path?: PropertyKey[];
}): any {
  return new Proxy(node, {
    get(target, prop) {
      if (prop === "__expr") {
        return target.__expr;
      }

      const expr: any = target.__expr;

      return createExprProxy({
        __expr: {
          ...(expr as any),
          __path: [...((expr as any).__path ?? []), prop],
        },
      });
    },
  });
}

function createService(serviceName: string) {
  return new Proxy(
    {},
    {
      get(_, method: string) {
        return (...args: any[]) =>
          expr({
            __service: serviceName,
            __method: method,
            __args: args.map(unwrapExpr),
            __path: [],
          });
      },
    },
  );
}
function remapExpr(expr: Expr, idToIdx: Record<string, number>): Expr {
  if (Array.isArray(expr)) {
    return expr.map((x) => remapExpr(x, idToIdx));
  }

  if (!expr || typeof expr !== "object") {
    return expr;
  }

  if ("__refKey" in expr) {
    return {
      __ref: idToIdx[expr.__refKey as string],
      __path: expr.__path ?? [],
    };
  }

  const out: any = {};

  for (const k in expr) {
    out[k] = remapExpr((expr as any)[k], idToIdx);
  }

  return out;
}

function compileAST(
  shape: Record<string, Expr>,
  meta: Record<string, StepOptions> = {},
) {
  const ids = Object.keys(shape);

  const guards: number[] = [];

  const __id = uniqueId();
  const steps: any[] = [];

  const idToIdx: Record<string, number> = {};

  let nextIdx = 0;
  const __stack: string[] = [__id];
  let initIdx: number | undefined;
  let outputIdx: number | undefined;

  function allocate(shape: Record<string, Expr>) {
    for (const id of Object.keys(shape)) {
      const expr = shape[id];

      if (isSubflowExpr(expr)) {
        const subWf = (expr as any).__workflow;

        if (subWf.__stack.includes(__id)) {
          throw new Error(
            `Cycle detected: ${subWf.__stack.join(" -> ")} -> ${__id}`,
          );
        }

        idToIdx[id] = nextIdx;

        nextIdx += 1;

        continue;
      }

      idToIdx[id] = nextIdx++;

      if (isIfExpr(expr)) {
        allocate((expr as any).__value);
      }
    }
  }

  allocate(shape);

  function compileShape(shape: Record<string, Expr>, activeGuards: number[]) {
    for (const id of Object.keys(shape)) {
      const expr = shape[id];

      if (isSubflowExpr(expr)) {
        const subInputResolve = remapExpr((expr as any).__input, idToIdx);

        steps.push({
          id,
          idx: idToIdx[id],
          spec: "__sub__",
          guards: [...activeGuards],

          resolve: subInputResolve,
          dependsOn: [
            ...new Set([...extractDeps(subInputResolve), ...activeGuards]),
          ],
          ...(meta[id] && { options: meta[id] }),

          ast: (expr as any).__workflow,
        } satisfies StepDef);

        continue;
      }

      if (isPipeExpr(expr)) {
        const idx = idToIdx[id];

        const pipeWorkflow = (expr as any).__workflow;

        nextIdx += pipeWorkflow.steps.length;

        const pipeInputResolve = remapExpr((expr as any).__input, idToIdx);

        steps.push({
          id,
          idx,
          spec: "__pipe__",

          dependsOn: [
            ...new Set([...extractDeps(pipeInputResolve), ...activeGuards]),
          ],

          guards: [...activeGuards],

          resolve: pipeInputResolve,

          pipeMode: (expr as any).__mode,
          ast: (expr as any).__workflow,

          ...(meta[id] && { options: meta[id] }),
        } satisfies StepDef);

        continue;
      }

      if (isIfExpr(expr)) {
        const idx = idToIdx[id];

        const condResolve = remapExpr((expr as any).__cond, idToIdx);

        steps.push({
          id,
          idx,
          resolve: condResolve,

          dependsOn: [
            ...new Set([...extractDeps(condResolve), ...activeGuards]),
          ],

          guards: [...activeGuards],
          ...(meta[id] && { options: meta[id] }),
        });

        compileShape((expr as any).__value, [...activeGuards, idx]);

        continue;
      }

      const resolve = remapExpr(expr, idToIdx);
      const deps = extractDeps(resolve);

      const idx = idToIdx[id];

      if (id === "i") {
        initIdx = idx;
      }

      if (id === "out") {
        outputIdx = idx;
      }

      steps.push({
        id,
        idx,
        resolve,
        dependsOn: [...new Set([...deps, ...activeGuards])],
        guards: [...activeGuards],

        ...(meta[id] && { options: meta[id] }),
      });
    }
  }

  compileShape(shape, guards);

  return {
    __id,
    __stack,
    steps,
    guards,
    initIdx,
    outputIdx,
  };
}

function isSubflowExpr(v: any): boolean {
  return !!(v && typeof v === "object" && v.__subflow === true);
}

function isIfExpr(v: any): boolean {
  return !!(v && typeof v === "object" && v.__if === true);
}

function isPipeExpr(v: any): boolean {
  return !!(v && typeof v === "object" && v.__pipe === true);
}

export function createWorkflowCtx<
  SR extends ServiceRegistry,
  Schema extends StepSchema,
>(): WorkflowCtx<SR, Schema> {
  const steps = new Proxy(
    {},
    {
      get(_, key: string) {
        return expr({
          __refKey: key,
          __path: [],
        });
      },
    },
  );

  const ctx = new Proxy(
    {},
    {
      get(_, prop: string) {
        // builtins

        if (prop === "steps") {
          return steps;
        }

        if (prop === "IF") {
          return (cond: any, value: any) => ({
            __if: true,
            __cond: unwrapExpr(cond),
            __value: toExpr(value),
          });
        }

        if (prop === "SUB") {
          return (wf: any, input?: any) =>
            expr({
              __subflow: true,
              __workflow: wf,
              __input: input ? unwrapExpr(input) : null,
            });
        }

        if (prop === "PIPE") {
          return (
            mode: PipeMode,
            iterable: any[],
            input: Record<string, any> = {},
            wf: any,
          ) => ({
            __pipe: true,
            __mode: mode,
            __input: unwrapExpr({ ...input, items: iterable ?? [] }),
            __workflow: wf,
          });
        }

        // everything else = service

        return createService(prop);
      },
    },
  );

  return ctx as WorkflowCtx<SR, Schema>;
}

type InferInput<T> = T extends { i: infer I } ? I : never;

type InferOutput<T> = T extends { out: infer O } ? O : never;

export function buildWF<SR extends ServiceRegistry>() {
  return function wf<Schema extends StepSchema>(
    build: (ctx: WorkflowCtx<SR, Schema>) => WorkflowShape<Schema>,
  ) {
    const ctx = createWorkflowCtx<SR, Schema>();

    const rawShape = build(ctx);

    const {
      __meta = {},
      // out = undefined,
      i = undefined,
      ...shape
    } = rawShape as any;

    const shapeWithBoundry = {
      i: null,
      ...shape,
    };

    const normalized = toExpr(shapeWithBoundry);

    if (
      !normalized ||
      typeof normalized !== "object" ||
      Array.isArray(normalized)
    ) {
      throw new Error("Workflow must return object shape");
    }

    return compileAST(
      normalized as Record<string, Expr>,
      __meta,
    ) as WorkflowDef<InferInput<Schema>, InferOutput<Schema>>;
  };
}

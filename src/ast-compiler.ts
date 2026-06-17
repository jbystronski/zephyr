import { buildLevels } from "./build-levels.js";
import {
  CompiledStep,
  CompilerCtx,
  ExecutionPlan,
  Expr,
  StepDef,
  StepExecutor,
  WorkflowDef,
} from "./types.js";
import { isCallExpr, isPlainObject, isRefExpr } from "./workflow.js";

function generateExprCode(
  expr: Expr,
  ctx: CompilerCtx,
): {
  code: string;
  async: boolean;
} {
  // -----------------------------------
  // PRIMITIVE
  // -----------------------------------

  if (
    expr == null ||
    typeof expr === "string" ||
    typeof expr === "number" ||
    typeof expr === "boolean"
  ) {
    return {
      code: JSON.stringify(expr),
      async: false,
    };
  }

  // -----------------------------------
  // REF
  // -----------------------------------

  if (isRefExpr(expr)) {
    const ref = expr.__ref;
    const path = expr.__path ?? [];

    const parts: string[] = [];

    // let code = `readResult(rt.results, ${ref})`;

    parts.push(`rt.results[${ref}]`);
    for (const p of path) {
      parts.push(`?.[${JSON.stringify(p)}]`);
      // code += `?.[${JSON.stringify(p)}]`;
    }

    return {
      // code,
      code: parts.join(""),
      async: false,
    };
  }

  if (isCallExpr(expr)) {
    // const fn = ctx.services[expr.__service]?.[expr.__method];

    const serviceMeta = ctx.meta?.[expr.__service];
    const methodMeta = serviceMeta?.methods?.[expr.__method];

    const isAsync =
      serviceMeta?.service?.async === true || methodMeta?.async === true;
    // fn.constructor?.name === "AsyncFunction";

    const serviceAccess = `rt.services.${expr.__service}.${expr.__method}`;

    const compiledArgs = (expr.__args ?? []).map((a) =>
      generateExprCode(a, ctx),
    );

    const argsCode = compiledArgs.map((a) => a.code).join(", ");

    const hasAsyncArgs = compiledArgs.some((a) => a.async);

    let callCode = `${serviceAccess}(${argsCode})`;

    if (isAsync || hasAsyncArgs) {
      callCode = `(await ${callCode})`;
    }

    for (const p of expr.__path ?? []) {
      callCode += `?.[${JSON.stringify(p)}]`;
    }

    return {
      code: callCode,
      async: isAsync || hasAsyncArgs,
    };
  }

  // -----------------------------------
  // ARRAY
  // -----------------------------------

  if (Array.isArray(expr)) {
    const items = expr.map((e) => generateExprCode(e, ctx));

    return {
      code: `[${items.map((x) => x.code).join(", ")}]`,
      async: items.some((x) => x.async),
    };
  }

  // -----------------------------------
  // OBJECT
  // -----------------------------------

  if (isPlainObject(expr)) {
    const parts: string[] = [];
    const entries = Object.entries(expr).map(
      ([k, v]) => [k, generateExprCode(v, ctx)] as const,
    );

    for (const [k, v] of entries) {
      parts.push(`${JSON.stringify(k)}:${v.code}`);
    }

    return {
      code: `{${parts.join(",")}}`,
      async: entries.some(([, v]) => v.async),
    };

    // return {
    //   code: `{${entries
    //     .map(([k, v]) => `${JSON.stringify(k)}: ${v.code}`)
    //     .join(",")}}`,
    //
    //   async: entries.some(([, v]) => v.async),
    // };
  }

  throw new Error("Unknown expr");
}

function createStepExecutor(step: StepDef, ctx: CompilerCtx): StepExecutor {
  if (!step.resolve) {
    return () => undefined;
  }

  const generated = generateExprCode(step.resolve, ctx);

  const body = generated.async
    ? `
        return (async () => {
          return ${generated.code};
        })();
      `
    : `
        return ${generated.code};
      `;

  const compiled = new Function("rt", body);

  return (rt) => compiled(rt);
}

export function compileStep(step: StepDef, ctx: CompilerCtx): CompiledStep {
  return {
    id: step.id,
    idx: step.idx,
    deps: step.deps,
    guards: step.guards ?? [],
    options: step.options,
    spec: step.spec,
    resolve: step.resolve ? createStepExecutor(step, ctx) : null,
    ...(step?.pipeMode && { pipeMode: step.pipeMode }),
    ...((step as any)?.plan && { plan: (step as any).plan }),
  };
}

export function compileWorkflow(
  workflow: WorkflowDef<any, any>,
  ctx: CompilerCtx,
  cache: Map<string, ExecutionPlan>,
): ExecutionPlan {
  if (cache.has(workflow.__id)) {
    return cache.get(workflow.__id) as ExecutionPlan;
  }

  const compiledSteps = workflow.steps.map((step: any) => {
    if (step.ast) {
      return {
        ...step,
        ...(step?.pipeMode && { pipeMode: step.pipeMode }),
        plan: compileWorkflow(step.ast, ctx, cache),
      };
    }

    return step;
  });

  const levels = buildLevels(compiledSteps);

  const compiledLevels = levels.map((level) =>
    level.map((step) => compileStep(step, ctx)),
  );

  const maxIndex = workflow.steps.length - 1;

  const plan = {
    initIdx: workflow.initIdx ?? undefined,
    levels: compiledLevels,
    outputIndex: workflow.outputIdx,
    maxIndex,
  };

  cache.set(workflow.__id, plan);

  return plan;
}

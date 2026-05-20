// import { isCallExpr, isPlainObject, isRefExpr } from "./ast.js";
// import { buildLevels } from "./build-levels.js";
//
// import { COMPILED_GRAPH, DEPS, EXEC_GRAPH } from "./symbols.js";
// import {
//   CompiledStep,
//   CompilerCtx,
//   ExecutionPlan,
//   Expr,
//   ResultsArray,
//   StepExecutor,
// } from "./types.js";
// import { StepDef, WorkflowDef } from "./workflow-composer.js";
//
// export function readResult(results: ResultsArray, idx: number): any {
//   let current: ResultsArray = results;
//
//   while (current) {
//     if (Object.prototype.hasOwnProperty.call(current, idx)) {
//       return current[idx];
//     }
//
//     current = current.__parent!;
//   }
//
//   return undefined;
// }
// function generateExprCode(
//   expr: Expr,
//   ctx: CompilerCtx,
//   bindings: Record<string, any>,
//   allocFn: () => string,
// ): {
//   code: string;
//   async: boolean;
// } {
//   // -----------------------------------
//   // PRIMITIVE
//   // -----------------------------------
//
//   if (
//     expr == null ||
//     typeof expr === "string" ||
//     typeof expr === "number" ||
//     typeof expr === "boolean"
//   ) {
//     return {
//       code: JSON.stringify(expr),
//       async: false,
//     };
//   }
//
//   // -----------------------------------
//   // REF
//   // -----------------------------------
//
//   if (isRefExpr(expr)) {
//     const ref = expr.__ref;
//     const path = expr.__path ?? [];
//
//     let code = `readResult(rt.results, ${ref})`;
//
//     for (const p of path) {
//       code += `?.[${JSON.stringify(p)}]`;
//     }
//
//     return {
//       code,
//       async: false,
//     };
//   }
//
//   if (isCallExpr(expr)) {
//     const fn = ctx.services[expr.__service][expr.__method];
//
//     const serviceMeta = ctx.meta?.[expr.__service];
//     const methodMeta = serviceMeta?.methods?.[expr.__method];
//
//     const isAsync =
//       serviceMeta?.async === true ||
//       methodMeta?.async === true ||
//       fn.constructor?.name === "AsyncFunction";
//
//     const fnId = allocFn();
//
//     bindings[fnId] = fn;
//
//     const compiledArgs = (expr.__args ?? []).map((a) =>
//       generateExprCode(a, ctx, bindings, allocFn),
//     );
//
//     const argsCode = compiledArgs.map((a) => a.code).join(", ");
//
//     const hasAsyncArgs = compiledArgs.some((a) => a.async);
//
//     let callCode = `${fnId}(${argsCode})`;
//
//     if (isAsync || hasAsyncArgs) {
//       callCode = `(await ${callCode})`;
//     }
//
//     for (const p of expr.__path ?? []) {
//       callCode += `?.[${JSON.stringify(p)}]`;
//     }
//
//     return {
//       code: callCode,
//       async: isAsync || hasAsyncArgs,
//     };
//   }
//
//   // -----------------------------------
//   // ARRAY
//   // -----------------------------------
//
//   if (Array.isArray(expr)) {
//     const items = expr.map((e) => generateExprCode(e, ctx, bindings, allocFn));
//
//     return {
//       code: `[${items.map((x) => x.code).join(", ")}]`,
//       async: items.some((x) => x.async),
//     };
//   }
//
//   // -----------------------------------
//   // OBJECT
//   // -----------------------------------
//
//   if (isPlainObject(expr)) {
//     const entries = Object.entries(expr).map(
//       ([k, v]) => [k, generateExprCode(v, ctx, bindings, allocFn)] as const,
//     );
//
//     return {
//       code: `{${entries
//         .map(([k, v]) => `${JSON.stringify(k)}: ${v.code}`)
//         .join(",")}}`,
//
//       async: entries.some(([, v]) => v.async),
//     };
//   }
//
//   throw new Error("Unknown expr");
// }
//
// function createStepExecutor(
//   step: StepDef<any>,
//   ctx: CompilerCtx,
// ): StepExecutor {
//   if (!step.resolve) {
//     return () => undefined;
//   }
//
//   const bindings: Record<string, any> = {};
//
//   let fnId = 0;
//
//   const allocFn = () => `__fn${fnId++}`;
//
//   const generated = generateExprCode(step.resolve, ctx, bindings, allocFn);
//
//   const argNames = ["rt", "readResult", ...Object.keys(bindings)];
//
//   const body = generated.async
//     ? `
//         return (async () => {
//           return ${generated.code};
//         })();
//       `
//     : `
//         return ${generated.code};
//       `;
//
//   const compiled = new Function(...argNames, body);
//
//   const boundFns = Object.values(bindings);
//
//   return (rt) => compiled(rt, readResult, ...boundFns);
// }
//
// export function compileStep(
//   step: StepDef<any>,
//   ctx: CompilerCtx,
// ): CompiledStep {
//   return {
//     id: step.id,
//     idx: step.idx,
//     deps: step.dependsOn,
//     guards: step.guards ?? [],
//     spec: step.spec,
//     resolve: step.resolve ? createStepExecutor(step, ctx) : null,
//     pipe: step.pipe
//       ? {
//           mode: step.pipe.mode,
//           plan: (step.pipe as any).plan, // <- already recursively compiled
//         }
//       : undefined,
//   };
// }
//
// export function compileWorkflow(
//   workflow: WorkflowDef<any, any, any, any>,
//   ctx: CompilerCtx,
// ): ExecutionPlan {
//   let outputIndex: number | undefined;
//
//   let exitIndexes: number[] | undefined;
//
//   if (workflow.outputIdx !== undefined) {
//     outputIndex = workflow.outputIdx;
//   } else if (workflow.endSteps?.length) {
//     exitIndexes = workflow.endSteps.map((s) => s.idx);
//   }
//
//   const compiledSteps = workflow.steps.map((step: any) => {
//     if (step.pipe?.workflow) {
//       return {
//         ...step,
//
//         pipe: {
//           ...step.pipe,
//
//           plan: compileWorkflow(step.pipe.workflow, ctx),
//         },
//       };
//     }
//
//     return step;
//   });
//
//   const levels = buildLevels(compiledSteps);
//
//   const compiledLevels = levels.map((level) =>
//     level.map((step) => compileStep(step, ctx)),
//   );
//
//   const maxIndex = Math.max(...workflow.steps.map((s: any) => s.idx));
//
//   return {
//     levels: compiledLevels,
//     outputIndex,
//     exitIndexes: exitIndexes ?? [],
//     maxIndex,
//   };
// }
//
// export function compileModule(mod: any, services: any, meta?: any): any {
//   const deps = mod[DEPS] ?? {};
//
//   const compiledDeps = Object.fromEntries(
//     Object.entries(deps).map(([name, child]: any) => [
//       name,
//       compileModule(child, services, meta),
//     ]),
//   );
//
//   const compiledGraph = Object.fromEntries(
//     Object.entries(mod[EXEC_GRAPH]).map(([wfId, wf]: any) => [
//       wfId,
//       compileWorkflow(wf, { services, meta }),
//     ]),
//   );
//
//   return {
//     ...mod,
//
//     [DEPS]: compiledDeps,
//
//     [COMPILED_GRAPH]: compiledGraph,
//   };
// }

import { isCallExpr, isPlainObject, isRefExpr } from "./ast.js";
import { buildLevels } from "./build-levels.js";

import { COMPILED_GRAPH, DEPS, EXEC_GRAPH } from "./symbols.js";
import {
  CompiledStep,
  CompilerCtx,
  ExecutionPlan,
  Expr,
  ResultsArray,
  StepExecutor,
} from "./types.js";
import { StepDef, WorkflowDef } from "./workflow-composer.js";

export function readResult(results: ResultsArray, idx: number): any {
  let current: ResultsArray = results;

  while (current) {
    if (Object.prototype.hasOwnProperty.call(current, idx)) {
      return current[idx];
    }

    current = current.__parent!;
  }

  return undefined;
}
function generateExprCode(
  expr: Expr,
  ctx: CompilerCtx,

  // allocFn: () => string,
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

    parts.push(`readResult(rt.results, ${ref})`);
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

    const isAsync = serviceMeta?.async === true || methodMeta?.async === true;
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

function createStepExecutor(
  step: StepDef<any>,
  ctx: CompilerCtx,
): StepExecutor {
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

  const compiled = new Function("rt", "readResult", body);

  return (rt) => compiled(rt, readResult);
}

export function compileStep(
  step: StepDef<any>,
  ctx: CompilerCtx,
): CompiledStep {
  return {
    id: step.id,
    idx: step.idx,
    deps: step.dependsOn,
    guards: step.guards ?? [],
    spec: step.spec,
    resolve: step.resolve ? createStepExecutor(step, ctx) : null,
    pipe: step.pipe
      ? {
          mode: step.pipe.mode,
          plan: (step.pipe as any).plan, // <- already recursively compiled
        }
      : undefined,
  };
}

export function compileWorkflow(
  workflow: WorkflowDef<any, any, any, any>,
  ctx: CompilerCtx,
): ExecutionPlan {
  let outputIndex: number | undefined;

  let exitIndexes: number[] | undefined;

  if (workflow.outputIdx !== undefined) {
    outputIndex = workflow.outputIdx;
  } else if (workflow.endSteps?.length) {
    exitIndexes = workflow.endSteps.map((s) => s.idx);
  }

  const compiledSteps = workflow.steps.map((step: any) => {
    if (step.pipe?.workflow) {
      return {
        ...step,

        pipe: {
          ...step.pipe,

          plan: compileWorkflow(step.pipe.workflow, ctx),
        },
      };
    }

    return step;
  });

  const levels = buildLevels(compiledSteps);

  const compiledLevels = levels.map((level) =>
    level.map((step) => compileStep(step, ctx)),
  );

  const maxIndex = Math.max(...workflow.steps.map((s: any) => s.idx));

  return {
    levels: compiledLevels,
    outputIndex,
    exitIndexes: exitIndexes ?? [],
    maxIndex,
  };
}

export function compileModule(mod: any, services: any, meta?: any): any {
  const deps = mod[DEPS] ?? {};

  const compiledDeps = Object.fromEntries(
    Object.entries(deps).map(([name, child]: any) => [
      name,
      compileModule(child, services, meta),
    ]),
  );

  const compiledGraph = Object.fromEntries(
    Object.entries(mod[EXEC_GRAPH]).map(([wfId, wf]: any) => [
      wfId,
      compileWorkflow(wf, { meta }),
    ]),
  );

  return {
    ...mod,

    [DEPS]: compiledDeps,

    [COMPILED_GRAPH]: compiledGraph,
  };
}

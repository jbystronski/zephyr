// import { isCallExpr, isPlainObject, isRefExpr } from "./ast.js";
// import { COMPILED_GRAPH, DEPS, EXEC_GRAPH } from "./symbols.js";
// import {
//   CallExpr,
//   CompiledExpr,
//   CompiledStep,
//   CompilerCtx,
//   ExecutionPlan,
//   Expr,
//   RefExpr,
//   ResultsArray,
//   StepRuntimeCtx,
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
//
// // function isExprNode(v: any): v is ExprNode {
// //   return (
// //     v &&
// //     typeof v === "object" &&
// //     typeof v.type === "string" &&
// //     (v.type === "const" || v.type === "get" || v.type === "call")
// //   );
// // }
//
// function compileRef(expr: RefExpr): (rt: StepRuntimeCtx) => any {
//   const ref = expr.__ref;
//   const path = expr.__path ?? [];
//
//   switch (path.length) {
//     case 0:
//       return (rt) => readResult(rt.results, ref);
//
//     case 1: {
//       const p0 = path[0];
//
//       return (rt) => readResult(rt.results, ref)?.[p0];
//     }
//
//     case 2: {
//       const p0 = path[0];
//       const p1 = path[1];
//
//       return (rt) => readResult(rt.results, ref)?.[p0]?.[p1];
//     }
//
//     default:
//       return (rt) => {
//         let value = readResult(rt.results, ref);
//
//         for (const p of path) {
//           value = value?.[p];
//         }
//
//         return value;
//       };
//   }
// }
//
// function compileCall(
//   expr: CallExpr,
//   ctx: CompilerCtx,
// ): (rt: StepRuntimeCtx) => Promise<any> {
//   const fn = ctx.services[expr.__service][expr.__method];
//
//   const serviceMeta = ctx.meta?.[expr.__service];
//   const methodMeta = serviceMeta?.methods?.[expr.__method];
//
//   const isAsync =
//     serviceMeta?.async === true ||
//     methodMeta?.async === true ||
//     fn.constructor?.name === "AsyncFunction";
//
//   const compiledArgs = (expr.__args ?? []).map((a) => compileExpr(a, ctx));
//
//   return async (rt) => {
//     const resolved = await Promise.all(
//       compiledArgs.map((a) => evalCompiled(a, rt)),
//     );
//
//     const result = fn(...resolved);
//
//     return isAsync ? await result : result;
//   };
// }
//
// export function compileExpr(expr: Expr, ctx: CompilerCtx): CompiledExpr {
//   // primitives
//   if (
//     expr == null ||
//     typeof expr === "string" ||
//     typeof expr === "number" ||
//     typeof expr === "boolean"
//   ) {
//     return expr;
//   }
//
//   // ref
//   if (isRefExpr(expr)) {
//     return compileRef(expr);
//   }
//
//   // call
//   if (isCallExpr(expr)) {
//     return compileCall(expr, ctx);
//   }
//
//   // array
//   if (Array.isArray(expr)) {
//     return expr.map((v) => compileExpr(v, ctx));
//   }
//
//   // object
//   if (isPlainObject(expr)) {
//     const out: Record<string, CompiledExpr> = {};
//
//     for (const k in expr) {
//       out[k] = compileExpr(expr[k], ctx);
//     }
//
//     return out;
//   }
//
//   throw new Error(`Unknown expr`);
// }
//
// export async function evalCompiled(
//   value: CompiledExpr,
//   rt: StepRuntimeCtx,
// ): Promise<any> {
//   // runtime closure
//   if (typeof value === "function") {
//     return value(rt);
//   }
//
//   // array
//   if (Array.isArray(value)) {
//     return Promise.all(value.map((v) => evalCompiled(v, rt)));
//   }
//
//   // object
//   if (isPlainObject(value)) {
//     const out: any = {};
//
//     for (const k in value) {
//       out[k] = await evalCompiled(value[k], rt);
//     }
//
//     return out;
//   }
//
//   // primitive
//   return value;
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
//     resolve: step.resolve ? compileExpr(step.resolve, ctx) : null,
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
//
// export function buildLevels(steps: StepDef<any>[]): StepDef<any>[][] {
//   const remainingDeps = new Map<number, number>();
//   const dependents = new Map<number, number[]>();
//   const ready: number[] = [];
//
//   const stepByIdx = new Map(steps.map((s) => [s.idx, s]));
//
//   for (const step of steps) {
//     remainingDeps.set(step.idx, step.dependsOn.length);
//
//     if (step.dependsOn.length === 0) {
//       ready.push(step.idx);
//     }
//
//     for (const dep of step.dependsOn) {
//       if (!dependents.has(dep)) {
//         dependents.set(dep, []);
//       }
//
//       dependents.get(dep)!.push(step.idx);
//     }
//   }
//
//   const levels: StepDef<any>[][] = [];
//
//   while (ready.length > 0) {
//     const batch = ready.splice(0);
//
//     levels.push(batch.map((idx) => stepByIdx.get(idx)!));
//
//     for (const idx of batch) {
//       for (const child of dependents.get(idx) ?? []) {
//         const left = remainingDeps.get(child)! - 1;
//
//         remainingDeps.set(child, left);
//
//         if (left === 0) {
//           ready.push(child);
//         }
//       }
//     }
//   }
//
//   return levels;
// }

///////////////////////////////////////////////////////////////

// import { isCallExpr, isPlainObject, isRefExpr } from "./ast.js";
// import { COMPILED_GRAPH, DEPS, EXEC_GRAPH } from "./symbols.js";
// import {
//   CallExpr,
//   CompiledExpr,
//   CompiledStep,
//   CompilerCtx,
//   ExecutionPlan,
//   Expr,
//   RefExpr,
//   ResultsArray,
//   StepRuntimeCtx,
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
//
// function compileRef(expr: RefExpr): (rt: StepRuntimeCtx) => any {
//   const ref = expr.__ref;
//   const path = expr.__path ?? [];
//
//   switch (path.length) {
//     case 0:
//       return (rt) => readResult(rt.results, ref);
//
//     case 1: {
//       const p0 = path[0];
//
//       return (rt) => readResult(rt.results, ref)?.[p0];
//     }
//
//     case 2: {
//       const p0 = path[0];
//       const p1 = path[1];
//
//       return (rt) => readResult(rt.results, ref)?.[p0]?.[p1];
//     }
//
//     default:
//       return (rt) => {
//         let value = readResult(rt.results, ref);
//
//         for (const p of path) {
//           value = value?.[p];
//         }
//
//         return value;
//       };
//   }
// }
//
// function compileCall(
//   expr: CallExpr,
//   ctx: CompilerCtx,
// ): (rt: StepRuntimeCtx) => Promise<any> {
//   const fn = ctx.services[expr.__service][expr.__method];
//
//   const serviceMeta = ctx.meta?.[expr.__service];
//   const methodMeta = serviceMeta?.methods?.[expr.__method];
//
//   const isAsync =
//     serviceMeta?.async === true ||
//     methodMeta?.async === true ||
//     fn.constructor?.name === "AsyncFunction";
//
//   // IMPORTANT: fully compile args once
//   const compiledArgs = (expr.__args ?? []).map((a) => compileExpr(a, ctx));
//
//   return async (rt) => {
//     const args = new Array(compiledArgs.length);
//
//     for (let i = 0; i < compiledArgs.length; i++) {
//       const a = compiledArgs[i];
//       args[i] = typeof a === "function" ? await a(rt) : a;
//     }
//
//     const result = fn(...args);
//     return isAsync ? await result : result;
//   };
// }
//
// export function compileExpr(expr: Expr, ctx: CompilerCtx): CompiledExpr {
//   // primitives (fully static)
//   if (
//     expr == null ||
//     typeof expr === "string" ||
//     typeof expr === "number" ||
//     typeof expr === "boolean"
//   ) {
//     return expr;
//   }
//
//   // REF → runtime accessor function
//   if (isRefExpr(expr)) {
//     return compileRef(expr);
//   }
//
//   // CALL → runtime function (but args precompiled)
//   if (isCallExpr(expr)) {
//     return compileCall(expr, ctx);
//   }
//
//   // ARRAY → compile elements once (NO runtime recursion)
//   if (Array.isArray(expr)) {
//     const compiled = expr.map((v) => compileExpr(v, ctx));
//
//     return (rt: StepRuntimeCtx) => {
//       const out = new Array(compiled.length);
//       for (let i = 0; i < compiled.length; i++) {
//         out[i] =
//           typeof compiled[i] === "function"
//             ? (compiled[i] as any)(rt)
//             : compiled[i];
//       }
//       return out;
//     };
//   }
//
//   // OBJECT → compile once into accessor function
//   if (isPlainObject(expr)) {
//     const entries = Object.entries(expr).map(([k, v]) => [
//       k,
//       compileExpr(v, ctx),
//     ]);
//
//     return (rt: StepRuntimeCtx) => {
//       const out: any = {};
//       for (const [k, v] of entries) {
//         out[k] = typeof v === "function" ? v(rt) : v;
//       }
//       return out;
//     };
//   }
//
//   throw new Error("Unknown expr");
// }
//
// export async function evalCompiled(value: CompiledExpr, rt: StepRuntimeCtx) {
//   if (typeof value === "function") {
//     return value(rt);
//   }
//   return value;
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
//     resolve: step.resolve ? compileExpr(step.resolve, ctx) : null,
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
//
// export function buildLevels(steps: StepDef<any>[]): StepDef<any>[][] {
//   const remainingDeps = new Map<number, number>();
//   const dependents = new Map<number, number[]>();
//   const ready: number[] = [];
//
//   const stepByIdx = new Map(steps.map((s) => [s.idx, s]));
//
//   for (const step of steps) {
//     remainingDeps.set(step.idx, step.dependsOn.length);
//
//     if (step.dependsOn.length === 0) {
//       ready.push(step.idx);
//     }
//
//     for (const dep of step.dependsOn) {
//       if (!dependents.has(dep)) {
//         dependents.set(dep, []);
//       }
//
//       dependents.get(dep)!.push(step.idx);
//     }
//   }
//
//   const levels: StepDef<any>[][] = [];
//
//   while (ready.length > 0) {
//     const batch = ready.splice(0);
//
//     levels.push(batch.map((idx) => stepByIdx.get(idx)!));
//
//     for (const idx of batch) {
//       for (const child of dependents.get(idx) ?? []) {
//         const left = remainingDeps.get(child)! - 1;
//
//         remainingDeps.set(child, left);
//
//         if (left === 0) {
//           ready.push(child);
//         }
//       }
//     }
//   }
//
//   return levels;
// }

/////////////////////////  to step codegen style

import { isCallExpr, isPlainObject, isRefExpr } from "./ast.js";
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
  bindings: Record<string, any>,
  allocFn: () => string,
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

    let code = `readResult(rt.results, ${ref})`;

    for (const p of path) {
      code += `?.[${JSON.stringify(p)}]`;
    }

    return {
      code,
      async: false,
    };
  }

  // -----------------------------------
  // CALL
  // -----------------------------------

  if (isCallExpr(expr)) {
    const fn = ctx.services[expr.__service][expr.__method];

    const serviceMeta = ctx.meta?.[expr.__service];
    const methodMeta = serviceMeta?.methods?.[expr.__method];

    const isAsync =
      serviceMeta?.async === true ||
      methodMeta?.async === true ||
      fn.constructor?.name === "AsyncFunction";

    const fnId = allocFn();

    bindings[fnId] = fn;

    const compiledArgs = (expr.__args ?? []).map((a) =>
      generateExprCode(a, ctx, bindings, allocFn),
    );

    const argsCode = compiledArgs.map((a) => a.code).join(", ");

    const hasAsyncArgs = compiledArgs.some((a) => a.async);

    const callCode = `${fnId}(${argsCode})`;

    return {
      code: isAsync || hasAsyncArgs ? `await ${callCode}` : callCode,

      async: isAsync || hasAsyncArgs,
    };
  }

  // -----------------------------------
  // ARRAY
  // -----------------------------------

  if (Array.isArray(expr)) {
    const items = expr.map((e) => generateExprCode(e, ctx, bindings, allocFn));

    return {
      code: `[${items.map((x) => x.code).join(", ")}]`,
      async: items.some((x) => x.async),
    };
  }

  // -----------------------------------
  // OBJECT
  // -----------------------------------

  if (isPlainObject(expr)) {
    const entries = Object.entries(expr).map(
      ([k, v]) => [k, generateExprCode(v, ctx, bindings, allocFn)] as const,
    );

    return {
      code: `{${entries
        .map(([k, v]) => `${JSON.stringify(k)}: ${v.code}`)
        .join(",")}}`,

      async: entries.some(([, v]) => v.async),
    };
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

  const bindings: Record<string, any> = {};

  let fnId = 0;

  const allocFn = () => `__fn${fnId++}`;

  const generated = generateExprCode(step.resolve, ctx, bindings, allocFn);

  const argNames = ["rt", "readResult", ...Object.keys(bindings)];

  const body = generated.async
    ? `
        return (async () => {
          return ${generated.code};
        })();
      `
    : `
        return ${generated.code};
      `;

  const compiled = new Function(...argNames, body);

  const boundFns = Object.values(bindings);

  return (rt) => compiled(rt, readResult, ...boundFns);
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
      compileWorkflow(wf, { services, meta }),
    ]),
  );

  return {
    ...mod,

    [DEPS]: compiledDeps,

    [COMPILED_GRAPH]: compiledGraph,
  };
}

export function buildLevels(steps: StepDef<any>[]): StepDef<any>[][] {
  const remainingDeps = new Map<number, number>();
  const dependents = new Map<number, number[]>();
  const ready: number[] = [];

  const stepByIdx = new Map(steps.map((s) => [s.idx, s]));

  for (const step of steps) {
    remainingDeps.set(step.idx, step.dependsOn.length);

    if (step.dependsOn.length === 0) {
      ready.push(step.idx);
    }

    for (const dep of step.dependsOn) {
      if (!dependents.has(dep)) {
        dependents.set(dep, []);
      }

      dependents.get(dep)!.push(step.idx);
    }
  }

  const levels: StepDef<any>[][] = [];

  while (ready.length > 0) {
    const batch = ready.splice(0);

    levels.push(batch.map((idx) => stepByIdx.get(idx)!));

    for (const idx of batch) {
      for (const child of dependents.get(idx) ?? []) {
        const left = remainingDeps.get(child)! - 1;

        remainingDeps.set(child, left);

        if (left === 0) {
          ready.push(child);
        }
      }
    }
  }

  return levels;
}

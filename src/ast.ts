import { CallExpr, Expr, Primitive, RefExpr } from "./types.js";

export function isPrimitive(v: any): v is Primitive {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

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

export function isExpr(v: any): v is Expr {
  return (
    isPrimitive(v) ||
    Array.isArray(v) ||
    isPlainObject(v) ||
    isRefExpr(v) ||
    isCallExpr(v)
  );
}

export function toExpr(v: any): Expr {
  // unwrap proxy values
  if (v && typeof v === "object" && "__expr" in v) {
    return v.__expr;
  }

  // primitives
  if (isPrimitive(v)) {
    return v;
  }

  // arrays
  if (Array.isArray(v)) {
    return v.map(toExpr);
  }

  // objects
  if (isPlainObject(v)) {
    const out: Record<string, Expr> = {};

    for (const k in v) {
      out[k] = toExpr(v[k]);
    }

    return out;
  }

  throw new Error(`Unsupported expr value: ${v}`);
}

export function createExprProxy(expr: any): any {
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      if (prop === "__expr") {
        return target.__expr;
      }

      return createExprProxy({
        ...target.__expr,

        __path: [...(target.__expr.__path ?? []), prop],
      });
    },
  };

  return new Proxy(
    {
      __expr: expr,
    },
    handler,
  );
}

// export function createGetter(ref: number): any {
//   const handler: ProxyHandler<any> = {
//     get(target, prop) {
//       if (prop === "__expr") {
//         return target.__expr;
//       }
//
//       return new Proxy(
//         {
//           __expr: {
//             __ref: ref,
//             __path: [...(target.__expr.__path ?? []), prop],
//           },
//         },
//         handler,
//       );
//     },
//   };
//
//   return new Proxy(
//     {
//       __expr: {
//         __ref: ref,
//         __path: [],
//       },
//     },
//     handler,
//   );
// }

export function createGetter(ref: number): any {
  return createExprProxy({
    __ref: ref,
    __path: [],
  });
}

// export function createExprCtx(idToIdx: Record<string, number>): any {
//   const root: any = {};
//
//   root.get = (key: string) => {
//     const idx = idToIdx[key];
//
//     if (idx === undefined) {
//       throw new Error(`Unknown ref "${key}"`);
//     }
//
//     return createGetter(idx);
//   };
//
//   return new Proxy(root, {
//     get(_, service) {
//       if (service === "get") {
//         return root.get;
//       }
//
//       return new Proxy(
//         {},
//         {
//           get(_, method) {
//             return (...args: any[]) => ({
//               __expr: {
//                 __service: service,
//                 __method: method,
//                 __args: args.map(toExpr),
//               },
//             });
//           },
//         },
//       );
//     },
//   });
// }
//

export function createExprCtx(idToIdx: Record<string, number>): any {
  const root: any = {};

  root.get = (key: string) => {
    const idx = idToIdx[key];

    if (idx === undefined) {
      throw new Error(`Unknown ref "${key}"`);
    }

    return createGetter(idx);
  };

  return new Proxy(root, {
    get(_, service) {
      if (service === "get") {
        return root.get;
      }

      return new Proxy(
        {},
        {
          get(_, method) {
            return (...args: any[]) =>
              createExprProxy({
                __service: service,
                __method: method,
                __args: args.map(toExpr),
                __path: [],
              });
          },
        },
      );
    },
  });
}

export function remapWorkflowInstance(
  subWf: any,

  inputAst: any,
  parentFrontier: number[],
  offset: number,
) {
  const { wf, maxIdx } = offsetWorkflow(subWf, offset);

  // fix init
  const initIdx = subWf.initIdx + offset;

  const initStep = wf.steps.find((s: any) => s.idx === initIdx);

  if (initStep) {
    initStep.dependsOn = parentFrontier.length ? [...parentFrontier] : [];

    if (initStep.spec === "__init__") {
      delete initStep.spec;
      initStep.resolve = inputAst;
    }
  }

  const outputIdx =
    subWf.outputIdx !== undefined ? subWf.outputIdx + offset : undefined;

  return {
    wf,
    outputIdx,
    maxIdx,
  };
}

export function offsetWorkflow(obj: any, offset: number) {
  let maxIdx = -Infinity;

  function walk(node: any): any {
    if (node === null || node === undefined) return node;
    if (typeof node !== "object") return node;

    if (Array.isArray(node)) {
      return node.map(walk);
    }

    const out: any = {};

    for (const key in node) {
      const value = node[key];

      if (key === "initIdx" && typeof value === "number") {
        const newIdx = value + offset;
        out[key] = newIdx;
        if (newIdx > maxIdx) maxIdx = newIdx;
        continue;
      }

      if (key === "idx" && typeof value === "number") {
        const newIdx = value + offset;
        out[key] = newIdx;
        if (newIdx > maxIdx) maxIdx = newIdx;
        continue;
      }

      if (key === "__ref" && typeof value === "number") {
        out[key] = value + offset;
        continue;
      }

      if (key === "dependsOn" && Array.isArray(value)) {
        out[key] = value.map((v) => v + offset);
        continue;
      }

      if (key === "entryMap" && value && typeof value === "object") {
        out[key] = Object.fromEntries(
          Object.entries(value as Record<string, number>).map(([k, v]) => [
            k,
            v + offset,
          ]),
        );
        continue;
      }

      if (key === "guards") {
        out[key] = Array.isArray(value)
          ? value.map((v) => v + offset)
          : value + offset;
        continue;
      }

      if (key === "exitMap" && Array.isArray(value)) {
        out[key] = value.map((v) => v + offset);
        continue;
      }

      if (key === "aliasMap" && value && typeof value === "object") {
        out[key] = {
          ...value,
          results: Object.fromEntries(
            Object.entries((value as Record<string, number>).results || {}).map(
              ([k, v]) => [k, v + offset],
            ),
          ),
        };
        continue;
      }

      out[key] = walk(value);
    }

    return out;
  }

  const wf = walk(obj);

  return {
    wf,
    maxIdx,
  };
}

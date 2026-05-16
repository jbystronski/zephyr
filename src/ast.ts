import { ServiceRegistry } from "./types.js";

export type ExprNode =
  | {
      type: "const";
      value: any;
    }
  | {
      type: "get";
      ref: number;
      path: (string | symbol)[];
    }
  | {
      type: "call";
      service: string;
      method: string;
      args: ExprNode[];
    };

export type ExprServiceCtx<S extends ServiceRegistry> = {
  [SK in keyof S]: {
    [MK in keyof S[SK]]: (
      ...args: Parameters<S[SK][MK]>
    ) => ExprValue<Awaited<ReturnType<S[SK][MK]>>>;
  };
};

export type ExprCtx<S extends ServiceRegistry, Results> = ExprServiceCtx<S> & {
  get<K extends keyof Results>(key: K): Results[K];
};

export type ExprValue<T> = T & {
  __node: ExprNode;
};

export type GetterProxy<T> = T & {
  __node: ExprNode;
};

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
            return (...args: any[]) => ({
              __node: {
                type: "call",
                service,
                method,
                args: args.map(toNode),
              },
            });
          },
        },
      );
    },
  });
}

export function toNode(v: any): ExprNode {
  if (v && typeof v === "object" && "__node" in v) {
    return v.__node;
  }

  if (Array.isArray(v)) {
    return {
      type: "const",
      value: v.map(toNode),
    };
  }

  if (v && typeof v === "object") {
    return {
      type: "const",
      value: Object.fromEntries(
        Object.entries(v).map(([k, val]) => [k, toNode(val)]),
      ),
    };
  }

  return {
    type: "const",
    value: v,
  };
}

export function createGetter(ref: number): any {
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      if (prop === "__node") return target.__node;

      return new Proxy(
        {
          __node: {
            type: "get",
            ref,
            path: [...target.__node.path, prop],
          },
        },
        handler,
      );
    },
  };

  return new Proxy(
    {
      __node: { type: "get", ref, path: [] },
    },
    handler,
  );
}

export function remapWorkflowInstance(
  subWf: any,
  prefix: string,
  inputAst: any,
  parentFrontier: number[],
  offset: number,
) {
  const { wf, maxIdx } = offsetWorkflow(subWf, offset);

  // fix init
  const initIdx = subWf.initIdx + offset;

  const initStep = wf.steps.find((s: any) => s.idx === initIdx);

  if (initStep) {
    initStep.resolve = inputAst;
    initStep.dependsOn = parentFrontier.length ? [...parentFrontier] : [];
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

      if (key === "idx" && typeof value === "number") {
        const newIdx = value + offset;
        out[key] = newIdx;
        if (newIdx > maxIdx) maxIdx = newIdx;
        continue;
      }

      if (key === "ref" && typeof value === "number") {
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

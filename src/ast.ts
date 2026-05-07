export type ArgNode =
  | { type: "const"; value: any }
  | { type: "get"; ref: number; path: (string | symbol)[] };

export type ConditionNode =
  | { type: "eq"; left: ArgNode; right: ArgNode }
  | { type: "neq"; left: ArgNode; right: ArgNode }
  | { type: "gt"; left: ArgNode; right: ArgNode }
  | { type: "gte"; left: ArgNode; right: ArgNode }
  | { type: "lt"; left: ArgNode; right: ArgNode }
  | { type: "lte"; left: ArgNode; right: ArgNode }
  | { type: "and"; conditions: ConditionNode[] }
  | { type: "or"; conditions: ConditionNode[] }
  | { type: "not"; condition: ConditionNode }
  | { type: "truthy"; value: ArgNode }
  | { type: "falsy"; value: ArgNode };

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

export function createWhenCtx(idToIdx: Record<string, number>) {
  return {
    get: ((key: string) => {
      const idx = idToIdx[key];
      // if (!idx) return createGetter(key);

      if (idx === undefined) {
        throw new Error(`Unresolved numeric index`);
      }

      return createGetter(idx);
    }) as any,

    eq: (a: any, b: any): ConditionNode => ({
      type: "eq",
      left: toNode(a),
      right: toNode(b),
    }),

    neq: (a: any, b: any): ConditionNode => ({
      type: "neq",
      left: toNode(a),
      right: toNode(b),
    }),

    gt: (a: any, b: any) => ({ type: "gt", left: toNode(a), right: toNode(b) }),
    gte: (a: any, b: any) => ({
      type: "gte",
      left: toNode(a),
      right: toNode(b),
    }),
    lt: (a: any, b: any) => ({ type: "lt", left: toNode(a), right: toNode(b) }),
    lte: (a: any, b: any) => ({
      type: "lte",
      left: toNode(a),
      right: toNode(b),
    }),

    and: (...conds: any) => ({ type: "and", conditions: conds }),
    or: (...conds: any) => ({ type: "or", conditions: conds }),
    not: (cond: any) => ({ type: "not", condition: cond }),

    truthy: (v: any) => ({ type: "truthy", value: toNode(v) }),
    falsy: (v: any) => ({ type: "falsy", value: toNode(v) }),
  };
}

export function createOutputCtx(idToIdx: Record<string, number>) {
  return {
    get: ((key: string) => {
      const idx = idToIdx[key];

      if (idx === undefined) {
        throw new Error(
          `[output] Unknown ref "${key}". Must reference a defined step id.`,
        );
      }

      return createGetter(idx);
    }) as any,
  };
}

export function toNode(v: any): ArgNode {
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

  return { type: "const", value: v };
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
    initStep.resolve = [inputAst];
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

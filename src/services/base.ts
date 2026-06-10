export const stdLib = {
  // --- control ---
  if: (cond: any, a: any, b: any) => (cond ? a : b),
  has: (cond: any, a: any, b: any) => (cond ? a : b),
  coalesce: (...values: any[]) => {
    for (const v of values) {
      if (v !== undefined && v !== null) {
        return v;
      }
    }

    return undefined;
  },

  maybe: (cond: any, value: any) => {
    return cond ? value : undefined;
  },

  choose: (pairs: [boolean, any][], fallback?: any) => {
    for (const [cond, value] of pairs) {
      if (cond) {
        return value;
      }
    }

    return fallback;
  },

  firstDef: (...values: any[]) => {
    for (const v of values) {
      if (v !== undefined) {
        return v;
      }
    }

    return undefined;
  },

  firstTruthy: (...values: any[]) => {
    for (const v of values) {
      if (v) {
        return v;
      }
    }

    return undefined;
  },

  collect: (...values: any[]) => {
    return values.filter((v) => v !== undefined);
  },

  mergeDef: (...objs: Record<string, any>[]) => {
    const out: Record<string, any> = {};

    for (const obj of objs) {
      if (!obj || typeof obj !== "object") {
        continue;
      }

      for (const key in obj) {
        const value = obj[key];

        if (value !== undefined) {
          out[key] = value;
        }
      }
    }

    return out;
  },

  concat: (...parts: any[]) => parts.join(""),
  const: (v: any) => v,
};

export const objectLib = {
  get: (obj: any, key: string) => obj?.[key],

  getAtPath: (obj: any, path: string): any => {
    const keys = path.split(".");

    return keys.reduce((acc, key) => {
      if (!acc) return undefined;

      const match = key.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        const [, arrKey, index] = match;
        return acc[arrKey]?.[Number(index)];
      }

      return acc[key];
    }, obj);
  },

  has: (obj: any, key: string) => key in (obj ?? {}),

  keys: (obj: any) => Object.keys(obj ?? {}),
  values: (obj: any) => Object.values(obj ?? {}),
  entries: (obj: any) => Object.entries(obj ?? {}),

  fromEntries: (entries: [string, any][]) => Object.fromEntries(entries),

  assign: (...objs: any[]) => Object.assign({}, ...objs),

  // merge: (...objs: Record<string, any>[]) => {
  //   const out: Record<string, any> = {};
  //   for (const o of objs) {
  //     if (o && typeof o === "object") Object.assign(out, o);
  //   }
  //   return out;
  // },

  merge: (...objs: Record<string, any>[]) => {
    if (objs.length === 0) return {};
    if (objs.length === 1) return { ...objs[0] };

    const mergeTwo = (
      target: Record<string, any>,
      source: Record<string, any>,
    ) => {
      const result = { ...target };

      for (const key in source) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (
          sourceValue &&
          targetValue &&
          typeof sourceValue === "object" &&
          typeof targetValue === "object" &&
          !Array.isArray(sourceValue)
        ) {
          result[key] = mergeTwo(targetValue, sourceValue);
        } else {
          result[key] = sourceValue;
        }
      }

      return result;
    };

    let result = { ...objs[0] };
    for (let i = 1; i < objs.length; i++) {
      if (objs[i] && typeof objs[i] === "object") {
        result = mergeTwo(result, objs[i]);
      }
    }

    return result;
  },

  pick: (obj: Record<string, any>, keys: string[]) => {
    const out: any = {};
    for (const k of keys) if (k in obj) out[k] = obj[k];
    return out;
  },

  omit: (obj: Record<string, any>, keys: string[]) => {
    const out = { ...obj };
    for (const k of keys) delete out[k];
    return out;
  },

  compact: (obj: Record<string, any>) => {
    const out: any = {};
    for (const k in obj) {
      const v = obj[k];
      if (v !== undefined && v !== null) out[k] = v;
    }
    return out;
  },

  setIfChanged: (key: string, prev: any, next: any): Record<string, any> => {
    return Object.is(prev, next) ? {} : { [key]: next };
  },

  // to be used when null has semantic meaning
  setIfDefined: (key: string, value: any | undefined): Record<string, any> => {
    return value === undefined ? {} : { [key]: value };
  },

  setIfPresent: (key: string, value: any | null | undefined) => {
    return value == null ? {} : { [key]: value };
  },
};

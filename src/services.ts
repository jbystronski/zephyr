export const stdLib = {
  // --- control ---
  if: (cond: any, a: any, b: any) => (cond ? a : b),
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

export const dateLib = {
  now: () => new Date(),

  from: (input: string | number | Date) => new Date(input),
  safeFrom: (input: any): Date | null => {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  },

  toISO: (d: Date) => d.toISOString(),
  toTimestamp: (d: Date) => d.getTime(),

  convert: (
    timestampMs: number,
    to: "ms" | "seconds" | "minutes" | "hours" | "days",
  ): number => {
    switch (to) {
      case "ms":
        return timestampMs;
      case "seconds":
        return Math.floor(timestampMs / 1000);
      case "minutes":
        return Math.floor(timestampMs / (1000 * 60));
      case "hours":
        return Math.floor(timestampMs / (1000 * 60 * 60));
      case "days":
        return Math.floor(timestampMs / (1000 * 60 * 60 * 24));
      default:
        throw new Error(`Invalid conversion target: ${to}`);
    }
  },

  // Convert from any unit to milliseconds
  toMs: (
    value: number,
    from: "ms" | "seconds" | "minutes" | "hours" | "days",
  ): number => {
    switch (from) {
      case "ms":
        return value;
      case "seconds":
        return value * 1000;
      case "minutes":
        return value * 60 * 1000;
      case "hours":
        return value * 60 * 60 * 1000;
      case "days":
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Invalid conversion source: ${from}`);
    }
  },

  // Convert duration between units
  convertDuration: (
    value: number,
    from: "ms" | "seconds" | "minutes" | "hours" | "days",
    to: "ms" | "seconds" | "minutes" | "hours" | "days",
  ): number => {
    const inMs = dateLib.toMs(value, from);
    return dateLib.convert(inMs, to);
  },

  durationFromNow: (
    futureDate: Date,
    unit: "ms" | "seconds" | "minutes" | "hours" | "days",
  ): number => {
    const now = new Date();
    const diffMs = futureDate.getTime() - now.getTime();
    return dateLib.convert(diffMs, unit);
  },

  isDateExpired: (dateString: string) =>
    new Date(dateString).getTime() < Date.now(),

  add: (
    d: Date,
    opts: {
      ms?: number;
      seconds?: number;
      minutes?: number;
      hours?: number;
      days?: number;
    },
  ) => {
    let t = d.getTime();
    if (opts.ms) t += opts.ms;
    if (opts.seconds) t += opts.seconds * 1000;
    if (opts.minutes) t += opts.minutes * 60_000;
    if (opts.hours) t += opts.hours * 3_600_000;
    if (opts.days) t += opts.days * 86_400_000;
    return new Date(t);
  },

  sub: (
    d: Date,
    opts: {
      ms?: number;
      seconds?: number;
      minutes?: number;
      hours?: number;
      days?: number;
    },
  ) => {
    let t = d.getTime();
    if (opts.ms) t -= opts.ms;
    if (opts.seconds) t -= opts.seconds * 1000;
    if (opts.minutes) t -= opts.minutes * 60_000;
    if (opts.hours) t -= opts.hours * 3_600_000;
    if (opts.days) t -= opts.days * 86_400_000;
    return new Date(t);
  },

  startOfDay: (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  },

  endOfDay: (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  },

  compare: (a: Date, b: Date) => a.getTime() - b.getTime(),
  isBefore: (a: Date, b: Date) => a.getTime() < b.getTime(),
  isAfter: (a: Date, b: Date) => a.getTime() > b.getTime(),
};

export const stringLib = {
  isEmail: (str: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  },
  lower: (s: string) => s.toLowerCase(),
  upper: (s: string) => s.toUpperCase(),
  trim: (s: string) => s.trim(),

  includes: (s: string, sub: string) => s.includes(sub),
  startsWith: (s: string, sub: string) => s.startsWith(sub),
  endsWith: (s: string, sub: string) => s.endsWith(sub),

  slice: (s: string, start?: number, end?: number) => s.slice(start, end),

  replace: (s: string, search: string, value: string) =>
    s.replace(search, value),

  split: (s: string, sep: string) => s.split(sep),
  join: (arr: string[], sep: string) => arr.join(sep),

  length: (s: string) => s.length,
};

export const arrayLib = {
  compact: (arr: any[]) => {
    return arr.filter((v) => v !== undefined && v !== null);
  },

  isOneOf: (allowedValues: readonly any[], value: unknown) => {
    return allowedValues.includes(value);
  },
  hasMax: (arr: any[], max: number): boolean => {
    if (!Array.isArray(arr)) return false;
    return arr.length <= max;
  },

  hasMin: (arr: any[], min: number): boolean => {
    if (!Array.isArray(arr)) return false;
    return arr.length >= min;
  },

  allEqual: (values: readonly any[]): boolean => {
    if (values.length === 0) return true;
    const firstType = typeof values[0];
    const firstValue = values[0];

    if (!values.every((v) => typeof v === firstType)) return false;

    return values.every((v) => v === firstValue);
  },

  length: (arr: any[]) => arr?.length ?? 0,
  ensure: (v: any) => (Array.isArray(v) ? v : v ? [v] : []),
  // --- access ---
  first: (arr: any[]) => arr?.[0],
  last: (arr: any[]) => arr?.[arr.length - 1],
  at: (arr: any[], i: number) => arr?.[i],

  // --- mutation-like (pure) ---

  append: (arr: any[], item: any) => [...(arr ?? []), item],
  prepend: (arr: any[], item: any) => [item, ...(arr ?? [])],
  fromLen: (len: number) => Array.from({ length: len }),

  removeAt: (arr: any[], i: number) =>
    arr ? arr.filter((_, idx) => idx !== i) : [],

  insertAt: (arr: any[], i: number, item: any) => {
    const a = [...(arr ?? [])];
    a.splice(i, 0, item);
    return a;
  },
  replaceAt: (arr: any[], i: number, item: any) => {
    const a = [...(arr ?? [])];
    a.splice(i, 1, item); // Note: 1 as delete count
    return a;
  },

  replaceFirst: (arr: any[], item: any) =>
    arr?.length ? arrayLib.replaceAt(arr, 0, item) : [],

  replaceLast: (arr: any[], item: any) =>
    arr?.length ? arrayLib.replaceAt(arr, arr.length - 1, item) : [],

  // --- set-like ---
  unique: (arr: any[]) => Array.from(new Set(arr)),
  includes: (arr: any[], v: any) => arr?.includes(v) ?? false,

  // --- set operations ---
  union: (...arrays: any[][]) => {
    const flattened = arrays.flat();
    return Array.from(new Set(flattened));
  },

  // For your specific use case - merges two arrays and makes unique
  mergeUnique: (arr1: any[], arr2: any[]) => {
    return Array.from(new Set([...(arr1 ?? []), ...(arr2 ?? [])]));
  },

  // If you need to merge multiple sources
  mergeAllUnique: (...arrays: any[][]) => {
    return Array.from(new Set(arrays.flat()));
  },

  // --- slicing ---
  slice: (arr: any[], start?: number, end?: number) =>
    arr?.slice(start, end) ?? [],

  take: (arr: any[], n: number) => arr?.slice(0, n) ?? [],
  drop: (arr: any[], n: number) => arr?.slice(n) ?? [],

  // --- combine ---
  concat: (...arrs: any[][]) => arrs.flat(),
  flatten: (arr: any[][]) => arr?.flat?.() ?? [],

  // --- guards ---
  isEmpty: (arr: any[]) => (arr?.length ?? 0) === 0,

  excludeIntersection: (...arrays: any[][]): any[] => {
    if (arrays.length === 0) return [];

    const counts = new Map<any, number>();

    for (const arr of arrays) {
      for (const item of new Set(arr)) {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      }
    }

    const total = arrays.length;

    return [...counts.entries()]
      .filter(([, count]) => count < total)
      .map(([item]) => item);
  },

  // Extract a specific property from each object in array
  pluck: <T extends Record<string, any>, K extends keyof T>(
    arr: T[],
    key: K,
  ): T[K][] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => item?.[key]).filter((v) => v !== undefined);
  },

  // Extract multiple properties from each object (returns array of objects)
  pluckMany: <T extends Record<string, any>, K extends keyof T>(
    arr: T[],
    keys: K[],
  ): Pick<T, K>[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => {
      const result: any = {};
      for (const key of keys) {
        if (key in item) result[key as string] = item[key];
      }
      return result;
    });
  },

  // Flatten array of objects by extracting a key, then flatten one level
  flatPluck: <T extends Record<string, any>, K extends keyof T>(
    arr: T[],
    key: K,
  ): T[K] extends any[] ? T[K][number][] : T[K][] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .flatMap((item) => {
        const value = item?.[key];
        return Array.isArray(value) ? value : [value];
      })
      .filter((v) => v !== undefined);
  },
};

export const mathLib = {
  add: (a: number, b: number) => a + b,
  sub: (a: number, b: number) => a - b,
  mul: (a: number, b: number) => a * b,
  div: (a: number, b: number) => a / b,
  neg: (n: number) => -n,

  mod: (a: number, b: number) => a % b,
  abs: (n: number) => Math.abs(n),

  min: (...nums: number[]) => Math.min(...nums),
  max: (...nums: number[]) => Math.max(...nums),

  round: (n: number) => Math.round(n),
  floor: (n: number) => Math.floor(n),
  ceil: (n: number) => Math.ceil(n),

  clamp: (n: number, min: number, max: number) =>
    Math.min(max, Math.max(min, n)),

  sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
  avg: (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
};

export const objectLib = {
  get: (obj: any, key: string) => obj?.[key],

  has: (obj: any, key: string) => key in (obj ?? {}),

  keys: (obj: any) => Object.keys(obj ?? {}),
  values: (obj: any) => Object.values(obj ?? {}),
  entries: (obj: any) => Object.entries(obj ?? {}),

  fromEntries: (entries: [string, any][]) => Object.fromEntries(entries),

  assign: (...objs: any[]) => Object.assign({}, ...objs),

  merge: (...objs: Record<string, any>[]) => {
    const out: Record<string, any> = {};
    for (const o of objs) {
      if (o && typeof o === "object") Object.assign(out, o);
    }
    return out;
  },

  collectObject: (obj: Record<string, any>) => {
    const out: Record<string, any> = {};

    for (const k in obj) {
      const v = obj[k];

      if (v !== undefined) {
        out[k] = v;
      }
    }

    return out;
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

  setAtPath: (obj: any, path: string, value: any): void => {
    const keys = path.split(".");
    const lastKey = keys.pop();

    const target = keys.reduce((acc, key) => {
      const match = key.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        const [, arrKey, index] = match;
        if (!acc[arrKey]) acc[arrKey] = [];
        if (!acc[arrKey][Number(index)]) acc[arrKey][Number(index)] = {};
        return acc[arrKey][Number(index)];
      }

      if (!acc[key]) acc[key] = {};
      return acc[key];
    }, obj);

    if (!lastKey) return;

    const match = lastKey.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const [, arrKey, index] = match;
      if (!target[arrKey]) target[arrKey] = [];
      target[arrKey][Number(index)] = value;
    } else {
      target[lastKey] = value;
    }
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

export const logicLib = {
  truthy: (v: any) => !!v,
  falsy: (v: any) => !v,
  and: (...vals: any[]) => vals.every(Boolean),
  or: (...vals: any[]) => vals.some(Boolean),
  not: (v: any) => !v,

  eq: (a: any, b: any) => a === b,
  neq: (a: any, b: any) => a !== b,

  gt: (a: any, b: any) => a > b,
  gte: (a: any, b: any) => a >= b,
  lt: (a: any, b: any) => a < b,
  lte: (a: any, b: any) => a <= b,
};

// good for workflows
export const miscLib = {
  identity: <T>(v: T) => v,

  isNil: (v: any) => v == null,
  isNumber: (v: any) => typeof v === "number",
  isString: (v: any) => typeof v === "string",
  isArray: (v: any) => Array.isArray(v),

  toNumber: (v: any) => Number(v),
  toString: (v: any) => String(v),
};

export const extendedJsonLib = {
  oid: (
    value: string | string[],
    fallback: any = null,
  ): { $oid: string } | { $oid: string }[] => {
    if (!value || (typeof value === "string" && value.trim() === ""))
      return fallback;

    if (Array.isArray(value)) {
      if (!value.length) return [];

      return value.map((v) => ({
        $oid: v,
      }));
    }

    return { $oid: value };
  },

  numberDecimal: (value: any | any[], fallback: string | number = 0) => {
    if (Array.isArray(value)) {
      if (!value.length) return [];

      return value.map((v) => ({
        $numberDecimal: v ?? fallback,
      }));
    }

    return { $numberDecimal: value ?? fallback };
  },

  numberInt: (value: any | any[], fallback: string | number = 0) => {
    if (Array.isArray(value)) {
      if (!value.length) return [];

      return value.map((v) => ({
        $numberInt: v ?? fallback,
      }));
    }

    return { $numberInt: value ?? fallback };
  },

  numberLong: (value: any | any[], fallback: string | number = 0) => {
    if (Array.isArray(value)) {
      if (!value.length) return [];

      return value.map((v) => ({
        $numberLong: v ?? fallback,
      }));
    }

    return { $numberLong: value ?? fallback };
  },

  date: (value: any | any[], fallback?: any) => {
    if (Array.isArray(value)) {
      if (!value.length) return [];

      return value.map((v) => ({
        $date: v ?? fallback,
      }));
    }

    return { $date: value ?? fallback };
  },
};

export const errLib = {
  fatal: (...msgParts: any[]) => {
    throw new Error(msgParts.join(""));
  },
};

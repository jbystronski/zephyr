import { objectLib } from "./object.js";

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

  allValuesEqual: (values: any[]): boolean => {
    if (values.length === 0) return true;
    const firstType = typeof values[0];
    const firstValue = values[0];

    if (!values.every((v) => typeof v === firstType)) return false;

    return values.every((v) => v === firstValue);
  },

  // 4. Check if arrays are equal (same elements, order doesn't matter)
  areEqual: (arrayA: any[], arrayB: any[]): boolean => {
    if (arrayA.length !== arrayB.length) return false;
    const setA = new Set(arrayA);
    const setB = new Set(arrayB);
    return [...setA].every((item) => setB.has(item));
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

  findDuplicates: (array: any[]): any[] => {
    const seen = new Set();
    const duplicates = new Set();

    for (const item of array) {
      if (seen.has(item)) {
        duplicates.add(item);
      } else {
        seen.add(item);
      }
    }

    return [...duplicates];
  },

  // 9. Partition array based on membership in another array
  partition: (arrayA: any[], arrayB: any[]): [any[], any[]] => {
    const setB = new Set(arrayB);
    const inBoth: any[] = [];
    const onlyInA: any[] = [];

    for (const item of arrayA) {
      if (setB.has(item)) {
        inBoth.push(item);
      } else {
        onlyInA.push(item);
      }
    }

    return [inBoth, onlyInA];
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

  // 1. Elements that exist in BOTH A and B (Intersection)
  intersection: (arrayA: any[], arrayB: any[]): any[] => {
    const setB = new Set(arrayB);
    return [...new Set(arrayA)].filter((item) => setB.has(item));
  },

  // 2. Elements that are NOT in both arrays (Symmetric Difference)
  // Returns elements that are in A or B, but not in both
  symmetricDifference: (arrayA: any[], arrayB: any[]): any[] => {
    const setA = new Set(arrayA);
    const setB = new Set(arrayB);

    const inAOnly = [...setA].filter((item) => !setB.has(item));
    const inBOnly = [...setB].filter((item) => !setA.has(item));

    return [...inAOnly, ...inBOnly];
  },

  // 3. Elements only in A (Difference: A - B)
  difference: (arrayA: any[], arrayB: any[]): any[] => {
    const setB = new Set(arrayB);
    return [...new Set(arrayA)].filter((item) => !setB.has(item));
  },

  // 5. Check if A is subset of B
  isSubset: (arrayA: any[], arrayB: any[]): boolean => {
    const setB = new Set(arrayB);
    return [...new Set(arrayA)].every((item) => setB.has(item));
  },

  // 6. Check if A is superset of B
  isSuperset: (arrayA: any[], arrayB: any[]): boolean => {
    const setA = new Set(arrayA);
    return [...new Set(arrayB)].every((item) => setA.has(item));
  },

  // Extract a specific property from each object in array
  // pluck: <T extends Record<string, any>, K extends keyof T>(
  //   arr: T[],
  //   key: K,
  // ): T[K][] => {
  //   if (!Array.isArray(arr)) return [];
  //   return arr.map((item) => item?.[key]).filter((v) => v !== undefined);
  // },

  pluck: (arr: Record<string, any>[], key: string): any[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => objectLib.getAtPath(item, key))
      .filter((v) => v !== undefined);
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

  random: (arr: any[]): any | undefined => {
    if (!arr.length) return undefined;
    const index = Math.floor(Math.random() * arr.length);
    return arr[index];
  },

  randomSubset: (arr: any[], min: number, max: number): any[] => {
    if (!arr.length || min > arr.length) return [];

    const size = Math.floor(Math.random() * (max - min + 1)) + min;

    // shuffle a copy of the array (Fisher-Yates)
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy.slice(0, Math.min(size, copy.length));
  },
};

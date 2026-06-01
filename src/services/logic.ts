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

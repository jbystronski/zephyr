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

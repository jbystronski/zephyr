import { describe, it, expect } from "vitest";

import {
  baseServices,
  createRuntime,
  StandardServices,
  useLog,
} from "../../src";

import { buildWF } from "../../src/";

const wf = buildWF<StandardServices>();

const a = wf<{
  i: { input: number };
  out: { a: number; b: number; c: number };
}>(
  ({
    IF,
    math: { mul, add },
    logic: { eq },
    steps: { i, step1, step2, step3, step4, out, guard },
  }) => ({
    step1: add(i.input, 3),
    step2: mul(step1, 2),
    guard: IF(eq(step2, 12), {
      step3: add(step2, 3),
      step4: add(step3, 3),
    }),
    out: {
      a: step2,
      b: step3,
      c: step4,
    },
  }),
);

const b = wf<{
  i: { input: number };
  out: { a: number; b: number; c: number; d: number };
}>(
  ({
    IF,
    math: { mul, add },
    logic: { eq },
    steps: { i, step1, step2, step3, step4, step5, out, guard },
  }) => ({
    step1: add(i.input, 3),
    step2: mul(step1, 2),
    guard: IF(eq(step2, 999), {
      step3: add(step2, 3),
      step4: add(step3, 3),
    }),
    step5: mul(step1, 2),
    out: {
      a: step2,
      b: step3,
      c: step4,
      d: step5,
    },
  }),
);

const root = createRuntime({ services: baseServices.build() });

describe("Workflow engine - linear execution with when", () => {
  it("should execute steps in correct order and skip / run steps conditionally", async () => {
    const resA = await root.exec(a, { input: 3 });
    expect(resA.output).toEqual({ a: 12, b: 15, c: 18 });
  });

  it("should skip step3 when condition is false", async () => {
    const resB = await root.exec(b, { input: 3 });
    expect(resB.output).toEqual({ a: 12, b: undefined, c: undefined, d: 12 });
  });
});

import { describe, it, expect } from "vitest";
import { buildWF } from "../../src/";

import { createRuntime, useLog } from "../../src";

describe("Retry handling at action level", () => {
  it("should retry actions inside subflows according to retry count", async () => {
    let retriesA = 0;
    let retriesSubAdd = 0;

    // Fake registry
    const actions = {
      math: {
        add: (a: number, b: number) => {
          retriesA++;
          if (retriesA < 2) throw new Error("temporary fail"); // fail once
          return a + b;
        },
        subAdd: (a: number, b: number) => {
          retriesSubAdd++;
          if (retriesSubAdd < 3) throw new Error("temporary subAdd fail"); // fail twice
          return a + b;
        },
      },
    };

    const wf = buildWF<{ math: (typeof actions)["math"] }>();

    const failStep = wf<{ i: { a: number; b: number }; subAdd: number }>(
      (_) => ({
        subAdd: _.math.subAdd(_.steps.i.a, _.steps.i.b),
        out: _.steps.subAdd,
        __meta: {
          subAdd: { retry: { count: 4 } },
        },
      }),
    );

    const test = wf<{ i: { x: number; y: number }; a: number }>((_) => ({
      a: _.math.add(_.steps.i.x, _.steps.i.y),
      b: _.SUB(failStep, { a: _.steps.a, b: 10 }),
      out: { a: _.steps.a, b: _.steps.b },
      __meta: {
        a: { retry: { count: 3 } },
      },
    }));

    const r0 = createRuntime({ services: actions });

    const res = await r0.exec(test, { x: 1, y: 2 });

    // ✅ Verify retry counts
    expect(retriesA).toBe(2); // retried once
    expect(retriesSubAdd).toBe(3); // retried twice inside subflow

    // ✅ Verify final outputs
    expect(res.output).toEqual({
      a: 3, // 1 + 2
      b: 13, // 3 + 10
    });
  });
});

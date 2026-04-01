import { describe, it, expect } from "vitest";
import { createModuleFactory } from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";

describe("Retry handling at action level", () => {
  it("should retry actions inside subflows according to retry count", async () => {
    let retriesA = 0;
    let retriesSubAdd = 0;

    // Fake registry
    const actions = {
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
    };

    const createMod = createModuleFactory<{}>();

    // Child workflow with retry on the action itself
    const child = createMod({
      actionRegistry: actions,
      define: ({ wf }) => {
        const failStep = wf<{ a: number; b: number }>("failStep")
          .seq(
            "subAdd",
            "subAdd",
            (ctx) => ctx.args(ctx.input.a, ctx.input.b),
            { retry: 4 }, // <--- retry on the action itself
          )
          .output((ctx) => ctx.results.subAdd);

        return { failStep };
      },
    });

    // Parent workflow
    const parent = createMod({
      actionRegistry: actions,
      use: { child },
      define: ({ wf }) => {
        const test = wf<{ x: number; y: number }>("test")
          .seq(
            "a",
            "add",
            (ctx) => ctx.args(ctx.input.x, ctx.input.y),
            { retry: 3 }, // retry on the parent action
          )
          .subflow("b", "child.failStep", (ctx) => ({
            a: ctx.results.a,
            b: 10,
          }))
          .output((ctx) => ({ a: ctx.results.a, b: ctx.results.b }));

        return { test };
      },
    });

    const rt = parent.createRuntime({ services: {} });
    const res = await rt.run("test", { x: 1, y: 2 }, [useLog()]);

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

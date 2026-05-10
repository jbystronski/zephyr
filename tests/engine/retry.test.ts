import { describe, it, expect } from "vitest";
import {
  createModuleFactory,
  createRuntimeRoot,
} from "../../src/workflow-module";
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

    const createMod = createModuleFactory<{ actions: typeof actions }>();

    // Child workflow with retry on the action itself
    const child = createMod({
      define: ({ wf }) => {
        const failStep = wf<{ a: number; b: number }>("failStep")
          .init("failInit")
          .seq(
            "subAdd",

            (ctx) =>
              ctx.actions.subAdd(ctx.get("failInit").a, ctx.get("failInit").b),
            { retry: 4 }, // <--- retry on the action itself
          )
          .output((ctx) => ctx.get("subAdd"));

        return { failStep };
      },
    });

    // Parent workflow
    const parent = createMod({
      use: { child },
      define: ({ wf }) => {
        const test = wf<{ x: number; y: number }>("test")
          .init("test_init")
          .seq(
            "a",

            (ctx) =>
              ctx.actions.add(ctx.get("test_init").x, ctx.get("test_init").y),
            { retry: 3 }, // retry on the parent action
          )
          .subflow("b", "child.failStep", (ctx) => ({
            a: ctx.get("a"),
            b: 10,
          }))
          .output((ctx) => ({ a: ctx.get("a"), b: ctx.get("b") }));

        return { test };
      },
    });

    const r0 = createRuntimeRoot({ module: parent, services: { actions } });

    const res = await r0.run("test", { x: 1, y: 2 }, [useLog()]);

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

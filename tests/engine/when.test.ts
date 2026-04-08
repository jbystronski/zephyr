import { describe, it, expect } from "vitest";
import { createWorkflow } from "../../src/workflow-composer";
import { runWorkflow, registryA } from "../utils";
import { useLog } from "../../src";

import { createModuleFactory } from "../../src/workflow-module";

describe("Workflow engine - linear execution with when", () => {
  it("should execute steps in correct order and skip / run steps conditionally", async () => {
    const wf = createWorkflow<typeof registryA, any, any>()<{ input: number }>(
      "linear-test",
    )
      .seq("step1", "add", (ctx) => ctx.args(ctx.input.input, 3))
      .seq("step2", "double", (ctx) => ctx.args(ctx.results.step1))
      .when((ctx) => ctx.results.step2 === 12)
      .seq("step3", "add", (ctx) => ctx.args(ctx.results.step2, 3))
      .as<number | undefined>()
      .seq("step4", "add", (ctx) => ctx.args(ctx.results.step3!, 3))
      .as<number | undefined>()
      .endWhen()
      .output((ctx) => ({
        a: ctx.step2,
        b: ctx.step3,
        c: ctx.step4,
      }));

    const { output } = await runWorkflow({
      workflow: wf,
      registry: registryA,
      input: { input: 3 },
      observers: [],
    });

    expect(output).toEqual({ a: 12, b: 15, c: 18 });
  });

  it("should skip step3 when condition is false", async () => {
    const wf = createWorkflow<typeof registryA, any, any>()<{ input: number }>(
      "linear-test",
    )
      .seq("step1", "add", (c) => c.args(c.input.input, 3))
      .seq("step2", "double", (c) => c.args(c.step1))
      .when((c) => c.step2 === 999) // ❌ false
      .seq("step3", "add", (c) => c.args(c.step2, 3))
      .as<number | undefined>()
      .seq("step4", "add", (c) => c.args(c.step2, 3))
      .as<number | undefined>()
      .endWhen()
      .seq("step5", "double", (ctx) => ctx.args(ctx.step1))
      .output((c) => ({
        a: c.step2,
        b: c.step3,
        c: c.step4,
        d: c.step5,
      }));

    const { output } = await runWorkflow({
      workflow: wf,
      registry: registryA,
      input: { input: 3 },
      observers: [],
    });

    expect(output).toEqual({ a: 12, b: undefined, c: undefined, d: 12 });
  });

  it("should conditionally execute parallel branches", async () => {
    const wf = createWorkflow()<{ input: number }>("parallel-when-test")
      .seq("step1", "add", (ctx) => ctx.args(ctx.input.input, 3)) // 3 + 3 = 6
      .seq("step2", "double", (ctx) => ctx.args(ctx.results.step1)) // 6 * 2 = 12

      .when((ctx) => ctx.results.step2 === 12)

      .parallel(
        (b0) =>
          b0
            .seq("p0", "add", (ctx) => ctx.args(ctx.results.step2, 1)) // 13
            .as<number | undefined>(),

        (b1) =>
          b1
            .seq("p1", "add", (ctx) => ctx.args(ctx.results.step2, 2)) // 14
            .as<number | undefined>(),

        (b2) =>
          b2
            .seq("p2", "add", (ctx) => ctx.args(ctx.results.step2, 3)) // 15
            .as<number | undefined>(),
      )

      .endWhen()

      .output((ctx) => ({
        base: ctx.results.step2,
        p0: ctx.results.p0,
        p1: ctx.results.p1,
        p2: ctx.results.p2,
      }));

    const { output } = await runWorkflow({
      workflow: wf,
      registry: registryA,
      input: { input: 3 },
      observers: [],
    });

    expect(output).toEqual({
      base: 12,
      p0: 13,
      p1: 14,
      p2: 15,
    });
  });

  it("should skip all parallel branches when condition is false", async () => {
    const wf = createWorkflow<typeof registryA, any, any>()<{ input: number }>(
      "parallel-when-test",
    )
      .seq("step1", "add", (ctx) => ctx.args(ctx.input.input, 3)) // 6
      .seq("step2", "double", (ctx) => ctx.args(ctx.step1)) // 12

      .when((ctx) => ctx.results.step2 === 999) // ❌ false

      .parallel(
        (b0) =>
          b0
            .seq("p0", "add", (ctx) => ctx.args(ctx.step2, 1))
            .as<number | undefined>(),

        (b1) =>
          b1
            .seq("p1", "add", (ctx) => ctx.args(ctx.step2, 2))
            .as<number | undefined>(),

        (b2) =>
          b2
            .seq("p2", "add", (ctx) => ctx.args(ctx.step2, 3))
            .as<number | undefined>(),
      )

      .join("join")

      .output((ctx) => ({
        base: ctx.results.step2,
        p0: ctx.results.p0,
        p1: ctx.results.p1,
        p2: ctx.results.p2,
      }));

    const { output } = await runWorkflow({
      workflow: wf,
      registry: registryA,
      input: { input: 3 },
    });

    expect(output).toEqual({
      base: 12,
      p0: undefined,
      p1: undefined,
      p2: undefined,
    });
  });
});

describe("Workflow engine - parallel with independent when per branch", () => {
  it("should respect different when conditions per branch", async () => {
    const wf = createWorkflow()<{ input: number }>("parallel-branch-when-test")
      .seq("step1", "add", (ctx) => ctx.args(ctx.input.input, 3)) // 3 + 3 = 6
      .seq("step2", "double", (ctx) => ctx.args(ctx.results.step1)) // 6 * 2 = 12

      .parallel(
        // ✅ runs (12 === 12)
        (b0) =>
          b0
            .when((ctx) => ctx.results.step2 === 12)
            .seq("p0", "add", (ctx) => ctx.args(ctx.results.step2, 1)) // 13
            .as<number | undefined>(),
        // .endWhen(),

        // ❌ skipped (12 !== 999)
        (b1) =>
          b1
            .when((ctx) => ctx.results.step2 === 999)
            .seq("p1", "add", (ctx) => ctx.args(ctx.results.step2, 2))
            .as<number | undefined>(),
        // .endWhen(),

        // ✅ always runs
        (b2) =>
          b2
            .seq("p2", "add", (ctx) => ctx.args(ctx.results.step2, 3)) // 15
            .as<number | undefined>(),
      )

      .join("join")

      .output((ctx) => ({
        base: ctx.results.step2,
        p0: ctx.results.p0,
        p1: ctx.results.p1,
        p2: ctx.results.p2,
      }));

    const { output } = await runWorkflow({
      workflow: wf,
      registry: registryA,
      input: { input: 3 },
      observers: [],
    });

    expect(output).toEqual({
      base: 12,
      p0: 13,
      p1: undefined,
      p2: 15,
    });
  });

  it("should not leak when to later steps in branch if endWhen is used", async () => {
    const wf = createWorkflow()<{ input: number }>("when-scope-test")
      .seq("step1", "add", (ctx) => ctx.args(ctx.input.input, 3)) // 6
      .seq("step2", "double", (ctx) => ctx.args(ctx.results.step1)) // 12

      .parallel(
        (b0) =>
          b0
            .when(() => false)
            .seq("p0", "add", (ctx) => ctx.args(ctx.results.step2, 1)) // skipped
            .endWhen()
            .seq("p0_after", "add", (ctx) => ctx.args(ctx.results.step2, 10)), // should run

        (b1) => b1.seq("p1", "add", (ctx) => ctx.args(ctx.results.step2, 2)),
      )

      .join("join")

      .output((ctx) => ({
        p0: ctx.results.p0,
        p0_after: ctx.results.p0_after,
        p1: ctx.results.p1,
      }));

    const { output } = await runWorkflow({
      workflow: wf,
      registry: registryA,
      input: { input: 3 },
    });

    expect(output).toEqual({
      p0: undefined,
      p0_after: 22,
      p1: 14,
    });
  });

  it("should handle nested when inside parallel inside when", async () => {
    const wf = createWorkflow()<{ input: number }>("nested-when-test")
      .seq("step1", "add", (ctx) => ctx.args(ctx.input.input, 3)) // 6
      .seq("step2", "double", (ctx) => ctx.args(ctx.results.step1)) // 12

      // ✅ parent condition TRUE
      .when((ctx) => ctx.results.step2 === 12)

      .parallel(
        // ✅ both conditions TRUE → runs
        (b0) =>
          b0
            .when((ctx) => ctx.results.step2 === 12)
            .seq("p0", "add", (ctx) => ctx.args(ctx.results.step2, 1)) // 13
            .as<number | undefined>(),

        // ❌ inner condition FALSE → skipped
        (b1) =>
          b1
            .when((ctx) => ctx.results.step2 === 999)
            .seq("p1", "add", (ctx) => ctx.args(ctx.results.step2, 2))
            .as<number | undefined>(),

        // ✅ no inner condition → inherits parent → runs
        (b2) =>
          b2
            .seq("p2", "add", (ctx) => ctx.args(ctx.results.step2, 3)) // 15
            .as<number | undefined>(),
      )

      .endWhen()

      .join("join")

      .output((ctx) => ({
        base: ctx.results.step2,
        p0: ctx.results.p0,
        p1: ctx.results.p1,
        p2: ctx.results.p2,
      }));

    const { output } = await runWorkflow({
      workflow: wf,
      registry: registryA,
      input: { input: 3 },
      observers: [],
    });

    expect(output).toEqual({
      base: 12,
      p0: 13,
      p1: undefined,
      p2: 15,
    });
  });

  it("should handle join when all parallel branches are skipped", async () => {
    const wf = createWorkflow()<{ input: number }>("join-skip-test")
      .seq("step1", "add", (ctx) => ctx.args(ctx.input.input, 3)) // 6
      .seq("step2", "double", (ctx) => ctx.args(ctx.results.step1)) // 12

      // ❌ everything skipped
      .when((ctx) => ctx.results.step2 === 999)

      .parallel(
        (b0) =>
          b0
            .seq("p0", "add", (ctx) => ctx.args(ctx.results.step2, 1))
            .as<number | undefined>(),

        (b1) =>
          b1
            .seq("p1", "add", (ctx) => ctx.args(ctx.results.step2, 2))
            .as<number | undefined>(),
      )

      .endWhen()

      .join("join")

      // MUST still run
      .seq("after", "double", (ctx) => ctx.args(ctx.results.step1))

      .output((ctx) => ({
        base: ctx.results.step2,
        p0: ctx.results.p0,
        p1: ctx.results.p1,
        after: ctx.results.after,
      }));

    const { output } = await runWorkflow({
      workflow: wf,
      registry: registryA,
      input: { input: 3 },
      observers: [],
    });

    expect(output).toEqual({
      base: 12,
      p0: undefined,
      p1: undefined,
      after: 12, // ✅ proves join didn't block
    });
  });

  it("should skip subflow execution when condition is false", async () => {
    let executed = false;

    const createMod = createModuleFactory<{}>();
    const child = createMod({
      actionRegistry: registryA,
      define: ({ wf }) => ({
        sum: wf<{ a: number; b: number }>("sum")
          .seq("add", "add", (ctx) => {
            executed = true; // 🔥 detect execution
            return ctx.args(ctx.input.a, ctx.input.b);
          })
          .output((ctx) => ctx.results.add),
      }),
    });

    const parent = createMod({
      actionRegistry: registryA,
      use: { child },
      define: ({ wf }) => {
        const test = wf("test")
          .when(() => false) // ❌ skip subflow
          .subflow("result", "child.sum", () => ({ a: 2, b: 3 }))
          .as<number | undefined>()
          .endWhen()
          .output((ctx) => ctx.results.result);

        return { test };
      },
    });

    const rt = parent.createRuntime({ services: {} });

    const res = await rt.run("test", {}, []);

    expect(res.output).toBeUndefined();
    expect(executed).toBe(false); // 🔥 critical assertion
  });
});

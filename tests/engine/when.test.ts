import { describe, it, expect } from "vitest";

import { registryA } from "../utils";
import { useLog } from "../../src";

import {
  createModuleFactory,
  createRuntimeRoot,
} from "../../src/workflow-module";

const mod = createModuleFactory<{ actions: (typeof registryA)["actions"] }>()({
  define: ({ wf }) => ({
    a: wf<{ input: number }>("a")
      .init("a")
      .seq("step1", "actions", "add", (ctx) => ctx.args(ctx.get("a").input, 3))
      .seq("step2", "actions", "double", (ctx) => ctx.args(ctx.get("step1")))
      .if(
        "step2 equal 12",
        (ctx) => ctx.eq(ctx.get("step2"), 12),
        (b) =>
          b
            .seq("step3", "actions", "add", (ctx) =>
              ctx.args(ctx.get("step2"), 3),
            )

            .seq("step4", "actions", "add", (ctx) =>
              ctx.args(ctx.get("step3")!, 3),
            ),
      )

      .output((ctx) => ({
        a: ctx.get("step2"),
        b: ctx.get("step3"),
        c: ctx.get("step4"),
      })),

    b: wf<{ input: number }>("b")
      .init("b")
      .seq("step1", "actions", "add", (c) => c.args(c.get("b").input, 3))
      .seq("step2", "actions", "double", (c) => c.args(c.get("step1")))
      .if(
        "step2 equals 999",
        (c) => c.eq(c.get("step2"), 999),
        (b) =>
          b
            .seq("step3", "actions", "add", (c) => c.args(c.get("step2"), 3))

            .seq("step4", "actions", "add", (c) => c.args(c.get("step2"), 3)),
      ) // ❌ false

      .seq("step5", "actions", "double", (ctx) => ctx.args(ctx.get("step1")))
      .output(({ get }) => ({
        a: get("step2"),
        b: get("step3"),
        c: get("step4"),
        d: get("step5"),
      })),

    c: wf<{ input: number }>("c")
      .init("c")
      .seq("step1", "actions", "add", (ctx) => ctx.args(ctx.get("c").input, 3)) // 3 + 3 = 6
      .seq("step2", "actions", "double", (ctx) => ctx.args(ctx.get("step1"))) // 6 * 2 = 12

      .if(
        "step2 equals 12",
        (ctx) => ctx.eq(ctx.get("step2"), 12),
        (b) =>
          b
            .parallel(
              (b0) =>
                b0
                  .seq("p0", "actions", "add", (ctx) =>
                    ctx.args(ctx.get("step2"), 1),
                  ) // 13
                  .as<number | undefined>(),

              (b1) =>
                b1
                  .seq("p1", "actions", "add", (ctx) =>
                    ctx.args(ctx.get("step2"), 2),
                  ) // 14
                  .as<number | undefined>(),

              (b2) =>
                b2
                  .seq("p2", "actions", "add", (ctx) =>
                    ctx.args(ctx.get("step2"), 3),
                  ) // 15
                  .as<number | undefined>(),
            )
            .join(),
      )

      .output(({ get }) => ({
        base: get("step2"),
        p0: get("p0"),
        p1: get("p1"),
        p2: get("p2"),
      })),

    d: wf<{ input: number }>("d")
      .init("d")
      .seq("step1", "actions", "add", (ctx) => ctx.args(ctx.get("d").input, 3)) // 6
      .seq("step2", "actions", "double", (ctx) => ctx.args(ctx.get("step1"))) // 12

      .if(
        "step2 equals 999",
        (ctx) => ctx.eq(ctx.get("step2"), 999),
        (b) =>
          b
            .parallel(
              (b0) =>
                b0
                  .seq("p0", "actions", "add", (ctx) =>
                    ctx.args(ctx.get("step2"), 1),
                  )
                  .as<number | undefined>(),

              (b1) =>
                b1
                  .seq("p1", "actions", "add", (ctx) =>
                    ctx.args(ctx.get("step2"), 2),
                  )
                  .as<number | undefined>(),

              (b2) =>
                b2
                  .seq("p2", "actions", "add", (ctx) =>
                    ctx.args(ctx.get("step2"), 3),
                  )
                  .as<number | undefined>(),
            )

            .join(),
      ) // ❌ false

      .output(({ get }) => ({
        base: get("step2"),
        p0: get("p0"),
        p1: get("p1"),
        p2: get("p2"),
      })),

    e: wf<{ input: number }>("e")
      .init("e")
      .seq("step1", "actions", "add", (ctx) => ctx.args(ctx.get("e").input, 3)) // 3 + 3 = 6
      .seq("step2", "actions", "double", (ctx) => ctx.args(ctx.get("step1"))) // 6 * 2 = 12

      .parallel(
        // ✅ runs (12 === 12)
        (b0) =>
          b0.if(
            "step2 equals 12",
            (ctx) => ctx.eq(ctx.get("step2"), 12),
            (b) =>
              b.seq("p0", "actions", "add", (ctx) =>
                ctx.args(ctx.get("step2"), 1),
              ),
          ),

        // ❌ skipped (12 !== 999)
        (b1) =>
          b1.if(
            "step2 equals 999",
            (ctx) => ctx.eq(ctx.get("step2"), 999),
            (b) =>
              b.seq("p1", "actions", "add", (ctx) =>
                ctx.args(ctx.get("step2"), 2),
              ),
          ),

        // .endWhen(),

        // ✅ always runs
        (b2) =>
          b2
            .seq("p2", "actions", "add", (ctx) => ctx.args(ctx.get("step2"), 3)) // 15
            .as<number | undefined>(),
      )

      .join()

      .output(({ get }) => ({
        base: get("step2"),
        p0: get("p0"),
        p1: get("p1"),
        p2: get("p2"),
      })),

    g: wf<{ input: number }>("g")
      .init("g")
      .seq("step1", "actions", "add", (ctx) => ctx.args(ctx.get("g").input, 3)) // 6
      .seq("step2", "actions", "double", (ctx) => ctx.args(ctx.get("step1"))) // 12

      // ✅ parent condition TRUE
      .if(
        "step2 equals 12",
        (ctx) => ctx.eq(ctx.get("step2"), 12),
        (b) =>
          b.parallel(
            // ✅ both conditions TRUE → runs
            (b0) =>
              b0.if(
                "nested step2 equals 12",
                (ctx) => ctx.eq(ctx.get("step2"), 12),
                (b) =>
                  b.seq("p0", "actions", "add", (ctx) =>
                    ctx.args(ctx.get("step2"), 1),
                  ), // 13
              ),

            // ❌ inner condition FALSE → skipped
            (b1) =>
              b1.if(
                "nested step2 equals 999",
                (ctx) => ctx.eq(ctx.get("step2"), 999),
                (b) =>
                  b.seq("p1", "actions", "add", (ctx) =>
                    ctx.args(ctx.get("step2"), 2),
                  ),
              ),

            // ✅ no inner condition → inherits parent → runs
            (b2) =>
              b2
                .seq("p2", "actions", "add", (ctx) =>
                  ctx.args(ctx.get("step2"), 3),
                ) // 15
                .as<number | undefined>(),
          ),
      )

      .join()

      .output(({ get: _ }) => ({
        base: _("step2"),
        p0: _("p0"),
        p1: _("p1"),
        p2: _("p2"),
      })),

    h: wf<{ input: number }>("h")
      .init("h")
      .seq("step1", "actions", "add", (ctx) => ctx.args(ctx.get("h").input, 3)) // 6
      .seq("step2", "actions", "double", (ctx) => ctx.args(ctx.get("step1"))) // 12

      // ❌ everything skipped
      .if(
        "step2 equals 999",
        (ctx) => ctx.eq(ctx.get("step2"), 999),
        (b) =>
          b
            .parallel(
              (b0) =>
                b0
                  .seq("p0", "actions", "add", (ctx) =>
                    ctx.args(ctx.get("step2"), 1),
                  )
                  .as<number | undefined>(),

              (b1) =>
                b1
                  .seq("p1", "actions", "add", (ctx) =>
                    ctx.args(ctx.get("step2"), 2),
                  )
                  .as<number | undefined>(),
            )
            .join(),
      )

      // MUST still run
      .seq("after", "actions", "double", (ctx) => ctx.args(ctx.get("step1")))

      .output(({ get: _ }) => ({
        base: _("step2"),
        p0: _("p0"),
        p1: _("p1"),
        after: _("after"),
      })),
  }),
});

const root = createRuntimeRoot({ module: mod, services: { ...registryA } });

describe("Workflow engine - linear execution with when", () => {
  it("should execute steps in correct order and skip / run steps conditionally", async () => {
    const resA = await root.run("a", { input: 3 });
    expect(resA.output).toEqual({ a: 12, b: 15, c: 18 });
  });

  it("should skip step3 when condition is false", async () => {
    const resB = await root.run("b", { input: 3 });
    expect(resB.output).toEqual({ a: 12, b: undefined, c: undefined, d: 12 });
  });

  it("should conditionally execute parallel branches", async () => {
    const resC = await root.run("c", { input: 3 });
    expect(resC.output).toEqual({
      base: 12,
      p0: 13,
      p1: 14,
      p2: 15,
    });
  });

  it("should skip all parallel branches when condition is false", async () => {
    const resD = await root.run("d", { input: 3 });
    expect(resD.output).toEqual({
      base: 12,
      p0: undefined,
      p1: undefined,
      p2: undefined,
    });
  });
});

describe("Workflow engine - parallel with independent when per branch", () => {
  it("should respect different when conditions per branch", async () => {
    const resE = await root.run("e", { input: 3 });

    expect(resE.output).toEqual({
      base: 12,
      p0: 13,
      p1: undefined,
      p2: 15,
    });
  });

  it("should handle nested when inside parallel inside when", async () => {
    const resG = await root.run("g", { input: 3 });
    expect(resG.output).toEqual({
      base: 12,
      p0: 13,
      p1: undefined,
      p2: 15,
    });
  });

  it("should handle join when all parallel branches are skipped", async () => {
    const resH = await root.run("h", { input: 3 });
    expect(resH.output).toEqual({
      base: 12,
      p0: undefined,
      p1: undefined,
      after: 12, // ✅ proves join didn't block
    });
  });

  it("should skip subflow execution when condition is false", async () => {
    let executed = false;

    const createMod = createModuleFactory<{
      actions: (typeof registryA)["actions"];
    }>();
    const child = createMod({
      define: ({ wf }) => ({
        sum: wf<{ a: number; b: number }>("sum")
          .init("sum")
          .seq("add", "actions", "add", (ctx) => {
            executed = true; // 🔥 detect execution
            return ctx.args(ctx.get("sum").a, ctx.get("sum").b);
          })
          .output((ctx) => ctx.get("add")),
      }),
    });

    const parent = createMod({
      use: { child },
      define: ({ wf }) => {
        const test = wf("test")
          .if(
            "true equals false",
            (ctx) => ctx.eq(true, false),
            (b) => b.subflow("result", "child.sum", () => ({ a: 2, b: 3 })),
          ) // ❌ skip subflow

          .output((ctx) => ctx.get("result"));

        return { test };
      },
    });

    const rt = createRuntimeRoot({
      module: parent,
      services: { ...registryA },
    });

    const res = await rt.run("test", {}, []);

    expect(res.output).toBeUndefined();
    // expect(executed).toBe(false); // 🔥 critical assertion
  });
});

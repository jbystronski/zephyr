// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { createModule } from "../../src/workflow-module";

import {
  baseServices,
  createRuntime,
  createRuntimeBuilder,
  StandardServices,
  useLog,
} from "../../src";

const createMod = createModule<StandardServices>();

const child = createMod(({ wf }) => {
  const childWfOne = wf<{ a: number; b: number }>("one")
    .init("one_init")
    .seq("add", (ctx) =>
      ctx.math.add(ctx.get("one_init").a, ctx.get("one_init").b),
    )

    .output((ctx) => ctx.get("add"));

  return { childWfOne };
});

const parent = createMod(({ wf }) => {
  const test = wf("test")
    .sub("result", child.childWfOne, () => ({ a: 10, b: 10 }))
    .output((ctx) => ctx.get("result"));

  return { test, aliased: child.childWfOne };
});

describe("Expose", () => {
  it("should execute workflow with alias", async () => {
    const root = createRuntimeBuilder(baseServices.build())
      .addMod("parent", parent)
      .build();

    const res = await root.run("parent", "aliased", { a: 10, b: 10 });

    expect(res.output).toBe(20);
  });
});

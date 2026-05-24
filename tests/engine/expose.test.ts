// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import {
  createModuleFactory,
  createRuntimeRoot,
} from "../../src/workflow-module";

import { baseServices, StandardServices, useLog } from "../../src";

const createMod = createModuleFactory<StandardServices>();

const child = createMod({
  define: ({ wf }) => {
    const childWfOne = wf<{ a: number; b: number }>("one")
      .init("one_init")
      .seq("add", (ctx) =>
        ctx.math.add(ctx.get("one_init").a, ctx.get("one_init").b),
      )

      .output((ctx) => ctx.get("add"));

    return { childWfOne };
  },
});

const parent = createMod({
  use: { child },
  expose: { aliased: child.childWfOne },
  define: ({ wf, deps: { child } }) => {
    const test = wf("test")
      .sub("result", child.childWfOne, () => ({ a: 10, b: 10 }))
      .output((ctx) => ctx.get("result"));

    return { test };
  },
});

describe("Expose", () => {
  it("should execute workflow with alias", async () => {
    const root = createRuntimeRoot({
      modules: { parent },
      services: baseServices.build(),
    });

    const res = await root.run("parent", "aliased", { a: 10, b: 10 });

    expect(res.output).toBe(20);
  });
});

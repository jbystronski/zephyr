// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import {
  createModuleFactory,
  createRuntimeRoot,
} from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";

const createMod = createModuleFactory<typeof registryA>();

const child = createMod({
  define: ({ wf }) => {
    const childWfOne = wf<{ a: number; b: number }>("one")
      .init("one_init")
      .seq("add", (ctx) =>
        ctx.actions.add(ctx.get("one_init").a, ctx.get("one_init").b),
      )

      .output((ctx) => ctx.get("add"));

    return { childWfOne };
  },
});

const parent = createMod({
  use: { child },
  expose: { aliased: "child.childWfOne" },
  define: ({ wf }) => {
    const test = wf("test")
      .sub("result", "child.childWfOne", () => ({ a: 10, b: 10 }))
      .output((ctx) => ctx.get("result"));

    return { test };
  },
});

describe("Expose", () => {
  it("should execute workflow with alias", async () => {
    const root = createRuntimeRoot({
      module: parent,
      services: { ...registryA },
    });

    const res = await root.run("aliased", { a: 10, b: 10 }, [useLog()]);

    expect(res.output).toBe(20);
  });
});

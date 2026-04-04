// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { createModuleFactory } from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";

const createMod = createModuleFactory();

const child = createMod({
  actionRegistry: registryA,
  define: ({ wf }) => {
    const childWfOne = wf<{ a: number; b: number }>("one")
      .seq("add", "add", (ctx) => ctx.args(ctx.input.a, ctx.input.b))

      .output((ctx) => ctx.add);

    return { childWfOne };
  },
});

const parent = createMod({
  actionRegistry: registryA,
  use: { child },
  expose: { aliased: "child.childWfOne" },
  define: ({ wf }) => {
    const test = wf("test")
      .sub("result", "child.childWfOne", () => ({ a: 10, b: 10 }))
      .output((ctx) => ctx.result);

    return { test };
  },
});

describe("Expose", () => {
  it("should execute workflow with alias", async () => {
    const rt = parent.createRuntime({
      services: {},
    });

    const res = await rt.run("aliased", { a: 10, b: 10 }, [useLog()]);

    expect(res.output).toBe(20);
  });
});

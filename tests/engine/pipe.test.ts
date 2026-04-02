// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { createModuleFactory } from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";
type S1 = {
  enrich: (input: string, add: string) => string;
};

const createMod = createModuleFactory<{ s1: S1 }>();

const testPipe = createMod({
  actionRegistry: registryA,

  define: ({ wf }) => {
    const test = wf<{ elements: string[] }>("pipeElements")
      .pipe(
        "result",
        (ctx) => ctx.input.elements,
        (p) =>
          p
            .action("uppercase", (ctx) => ctx.args(ctx.current))
            .action("addPrefix", (ctx) => ctx.args(ctx.current, "<"))
            .action("addSuffix", (ctx) => ctx.args(ctx.current, ">"))
            .service("enrich", "s1", "enrich", (ctx) =>
              ctx.args(ctx.current, "!"),
            ),
      )
      .output((ctx) => ctx.results.result);

    return { test };
  },
});

describe("Pipe", () => {
  it("should execute pipe and return result", async () => {
    const rt = testPipe.createRuntime({
      services: {
        s1: {
          enrich: (input: string, add: string) => input + add,
        },
      },
    });

    const res = await rt.run(
      "test",
      {
        elements: ["cat", "dog", "bird"],
      },
      [useLog()],
    );

    expect(res.output).toEqual(["<CAT>!", "<DOG>!", "<BIRD>!"]);
  });
});

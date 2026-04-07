// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { createModuleFactory } from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";
type S1 = {
  enrich: (input: string, add: string) => string;
  addAnimal: (input: { initArray: string[]; newAnimal: string }) => string[];
};

const createMod = createModuleFactory<{ s1: S1 }>();

const testPipe = createMod({
  actionRegistry: registryA,

  define: ({ wf }) => {
    const test = wf<{ elements: string[]; another: string }>("pipeElements")
      .service("add_animal", "s1", "addAnimal", (ctx) =>
        ctx.obj({
          initArray: ctx.input.elements,
          newAnimal: ctx.input.another,
        }),
      )

      .pipe(
        "pv2",
        (ctx) => ctx.results.add_animal,
        (b) =>
          b
            .seq("upp", "uppercase", (ctx) => ctx.args(ctx.input))
            .seq("pref", "addPrefix", (ctx) => ctx.args(ctx.results.upp, "<"))
            .seq("suffix", "addSuffix", (ctx) =>
              ctx.args(ctx.results.pref, ">"),
            )
            .service("enrich", "s1", "enrich", (ctx) =>
              ctx.args(ctx.results.suffix, "!"),
            ),
      )

      .output((ctx) => ctx.pv2);

    return { test };
  },
});

describe("Pipe", () => {
  it("should execute pipe and return result", async () => {
    const rt = testPipe.createRuntime({
      services: {
        s1: {
          enrich: (input: string, add: string) => input + add,
          addAnimal: (input: { initArray: string[]; newAnimal: string }) => {
            const newArr = [...input.initArray, input.newAnimal];
            return newArr;
          },
        },
      },
    });

    const res = await rt.run(
      "test",
      {
        elements: ["cat", "dog", "bird"],
        another: "fish",
      },
      [useLog()],
    );

    expect(res.output).toEqual(["<CAT>!", "<DOG>!", "<BIRD>!", "<FISH>!"]);
  });
});

import { createModuleFactory } from "../src/workflow-module";
import { eventStream, useLog } from "../src";
type S1 = {
  enrich: (input: string, add: string) => string;
  addAnimal: (input: { initArray: string[]; newAnimal: string }) => string[];
};
export const registryA = {
  noop: () => {},
  add: (a: number, b: number) => a + b,
  sum: (input: { a: number; b: number }) => input.a + input.b,
  double: (n: number) => n * 2,
  addSuffix: (input: string, suffix: string) => input + suffix,
  addPrefix: (input: string, prefix: string) => prefix + input,
  uppercase: (input: string) => input.toUpperCase(),
};

eventStream.subscribe((ev: any) => {
  console.dir(ev, { depth: 3 });
});

type Entity = { animal: string; nums: number[] };

const createMod = createModuleFactory<{ s1: S1 }>();

const testPipe = createMod({
  actionRegistry: registryA,

  define: ({ wf }) => {
    const test = wf<{ elements: Entity[]; another: string }>("pipeElements")
      .service("en", "s1", "enrich", (ctx) => ctx.args("WOLF", "~"))
      .pipe(
        "pv2",
        (ctx) => ctx.input.elements,
        (b) =>
          b
            .seq("upp", "uppercase", (ctx) => ctx.args(ctx.input.animal))
            .seq("pref", "addPrefix", (ctx) => ctx.args(ctx.results.upp, "<"))
            .seq("suffix", "addSuffix", (ctx) =>
              ctx.args(ctx.results.pref, ">"),
            )
            .service("enrich", "s1", "enrich", (ctx) =>
              ctx.args(ctx.results.suffix, "!"),
            ),
      )

      .service("add_animal", "s1", "addAnimal", (ctx) =>
        ctx.obj({
          initArray: ctx.results.pv2,
          newAnimal: ctx.input.another,
        }),
      )

      .output((ctx) => ctx.add_animal);

    return { test };
  },
});

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
    elements: [{ animal: "cat" }, { animal: "dog" }, { animal: "bird" }],
    another: "fish",
  },
  [useLog()],
);

console.log(res);

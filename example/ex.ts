// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import {
  baseServices,
  createModuleFactory,
  createRuntimeRoot,
  eventStream,
  StandardServices,
  useLog,
} from "../src";

eventStream.subscribe((ev: any) => {
  console.dir(ev, { depth: 12 });
});
type Transformable = {
  kind: "mammal" | "reptile" | "bird";
  name: string;
  climate: "tropical" | "arctic" | "moderate";
};

const transformables: Transformable[] = [
  {
    kind: "mammal",
    climate: "moderate",
    name: "boar",
  },
  {
    kind: "reptile",
    climate: "tropical",
    name: "crocodile",
  },
  {
    name: "penguin",
    kind: "bird",
    climate: "arctic",
  },
  { name: "sparrow", kind: "bird", climate: "moderate" },
  {
    kind: "mammal",
    climate: "tropical",
    name: "elephant",
  },
  {
    kind: "mammal",
    climate: "moderate",
    name: "wolf",
  },
  {
    kind: "mammal",
    climate: "moderate",
    name: "elk",
  },
  {
    kind: "reptile",
    climate: "moderate",
    name: "steppe tortoise",
  },
  {
    kind: "bird",
    climate: "tropical",
    name: "parrot",
  },
];
type S1 = {
  addAnimal: (input: { initArray: string[]; newAnimal: string }) => string[];
};

const createMod = createModuleFactory<
  StandardServices & {
    s1: S1;
  }
>();

const subMod = createMod({
  define: ({ wf }) => ({
    addTen: wf<{ someNumbers: number[] }>("add ten")
      .init("i")
      .pipe(
        "add 10 pipe",
        "map",
        (_) => _.get("i").someNumbers,
        (b) =>
          b
            .init("processed entry")
            .seq("add", (_) => _.math.add(_.get("processed entry"), 10)),
      )
      .output((_) => _.get("add 10 pipe")),
  }),
});

const testPipe = createMod({
  use: { subMod },
  define: ({ wf }) => {
    const findFirstArcticBird = wf<{ data: Transformable[] }>(
      "firstArcticBirdTest",
    )
      .init("i")
      // .pipe(
      //   "uppercase animals",
      //   "map",
      //   (_) => _.get("i").data,
      //   (b) =>
      //     b.init("a1").seq("to upp", (_) => _.string.upper(_.get("a1").name)),
      // )
      //
      // .seq("some test", (_) => _.math.add(2, _.math.mul(5, _.math.max(122, 2))))
      .if(
        "has data",
        (_) => _.logic.truthy(_.get("i").data),
        (b) =>
          b.pipe(
            "firstArctictBird",
            "find",
            ({ get }) => get("i").data,
            (b) =>
              b
                .init("animal")
                .seq("first", ({ get, logic: { and, eq } }) =>
                  and(
                    eq(get("animal").kind, "bird"),
                    eq(get("animal").climate, "arctic"),
                  ),
                ),
          ),
      )

      .seq("assert found", (_) => _.get("firstArctictBird"))
      .output(({ get }) => ({
        bird: get("firstArctictBird"),
      }));

    const someAreTropical = wf<{ data: Transformable[] }>("someAreTropical")
      .init("i")
      .pipe(
        "someAreTropical",
        "some",
        ({ get }) => get("i").data,
        (b) =>
          b
            .init("animal")
            .seq("first", ({ get, logic: { and, eq } }) =>
              and(eq(get("animal").climate, "tropical")),
            ),
      )
      .output(({ get }) => get("someAreTropical"));

    const everyIsArctic = wf<{ data: Transformable[] }>("everyIsArctic")
      .init("i")
      .pipe(
        "everyIsArctic",
        "every",
        ({ get }) => get("i").data,
        (b) =>
          b
            .init("animal")
            .seq("first", ({ get, logic: { and, eq } }) =>
              and(eq(get("animal").climate, "arctic")),
            ),
      )
      .output(({ get }) => get("everyIsArctic"));

    const reptilesOnly = wf<{ data: Transformable[] }>("reptilesOnly")
      .init("i")
      .if(
        "has data",
        (_) => _.logic.truthy(_.get("i").data),
        (b) =>
          b.pipe(
            "reptilesOnly",
            "filter",
            ({ get }) => get("i").data,
            (b) =>
              b
                .init("animal")
                .seq("first", ({ get, logic: { and, eq } }) =>
                  and(eq(get("animal").kind, "reptile")),
                ),
          ),
      )
      .output(({ get }) => get("reptilesOnly"));

    const test = wf<{
      nestedArr: { name: string; arr: string[] }[];
      secondArr: { name: string; arr: string[] }[];
      nums: number[];
      elements: string[];
      from: Date;
      someSet: Set<string>;
      another: string;
      complex: Record<string, any>[];
    }>("pipeElements")
      .init("init")
      .seq("add suff", (_) => _.std.concat("dog", _.get("init").another))
      .seq("append", ({ get, array: { append: app } }) =>
        app(app(app(get("init").elements, "ant"), "moose"), "snake"),
      )
      .sub("adding 10", "subMod.addTen", (_) => ({
        someNumbers: _.get("init").nums,
      }))
      .parallel(
        (b) =>
          b.pipe(
            "first P",
            "map",
            (_) => _.get("init").nestedArr,
            (b) =>
              b
                .init("p entry")
                .seq("suffix", (_) =>
                  _.std.concat(_.get("p entry").name, "!!!!!"),
                )
                .pipe(
                  "nested pipe",
                  "map",
                  (_) => _.get("p entry").arr,
                  (b) =>
                    b
                      .init("nested p entry")
                      .seq("add pref", (_) =>
                        _.std.concat(_.get("nested p entry"), _.get("suffix")),
                      ),
                )
                .seq("final", (_) => ({
                  outer: _.get("suffix"),
                  arr: _.get("nested pipe"),
                })),
          ),
        (b) =>
          b.pipe(
            "second P",
            "map",
            (_) => _.get("init").secondArr,
            (b) =>
              b
                .init("second p entry")
                .seq("suffix", (_) =>
                  _.std.concat(_.get("second p entry").name, "$"),
                )
                .pipe(
                  "nested second pipe",
                  "map",
                  (_) => _.get("second p entry").arr,
                  (b) =>
                    b
                      .init("nested second p entry")
                      .seq("add pref again", (_) =>
                        _.std.concat(_.get("nested second p entry"), ">>"),
                      ),
                )
                .seq("final second", (_) => ({
                  outer: _.get("suffix"),
                  arr: _.get("nested second pipe"),
                })),
          ),
      )

      .join()
      .output((_) => ({
        addingTen: _.get("adding 10"),
        nestedSecond: _.get("second P"),
        nestedPres: _.get("first P"),
      }));

    const filterSome = wf<{ all: string[]; selected: string[] }>("filter some")
      .init("i")
      .pipe(
        "filtered",
        "filter",
        (_) => _.get("i").selected,
        (b) =>
          b.init("x").pipe(
            "some",
            "some",
            (_) => _.get("i").all,
            (b) =>
              b
                .init("y")
                .seq("check", (_) => _.logic.eq(_.get("x"), _.get("y"))),
          ),
      )
      .output((_) => _.get("filtered"));

    return {
      filterSome,
      test,
      findFirstArcticBird,
      someAreTropical,
      everyIsArctic,
      reptilesOnly,
    };
  },
});

const s = baseServices
  .add("s1", {
    addAnimal: (input: { initArray: string[]; newAnimal: string }) => {
      console.log("new animal", input.newAnimal);
      console.log("what is initArray in add animal");
      console.log(input.initArray);
      const newArr = [...input.initArray, input.newAnimal];
      return newArr;
    },
  })

  .build();

const r0 = createRuntimeRoot({
  module: testPipe,
  services: s,
});

console.dir(testPipe.__public.test, { depth: 12 });

const r = await r0.run(
  "test",
  {
    nestedArr: [
      { name: "wolf", arr: ["leaf", "tree", "cloud"] },
      { name: "dog", arr: ["dirt", "sea", "snow"] },
    ],
    secondArr: [
      { name: "bird", arr: ["nest", "tree", "branch"] },
      { name: "fly", arr: ["web", "cellar", "shadow"] },
    ],

    nums: [4, 233, 112],
    someSet: new Set<string>(["ab", "cd"]),
    from: new Date(),
    elements: ["dog"],
    another: "fish",
    complex: [
      {
        topArr: [false, true, true],
        entities: [
          {
            name: "human",
            planet: "earth",
          },
        ],
      },
    ],
  },
  [useLog()],
);

console.log(r);

const r2 = await r0.run(
  "filterSome",
  {
    selected: ["1", "2"],
    all: ["1", "2", "4", "6"],
  },
  [useLog()],
);

console.log(r2);

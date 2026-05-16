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
  console.dir(ev, { depth: 3 });
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

const testPipe = createMod({
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

    const test = wf<{ elements: string[]; another: string }>("pipeElements")
      .init("init")
      .seq("add suff", (_) => _.std.concat("dog", _.get("init").another))
      .seq("append", ({ get, array: { append: app } }) =>
        app(app(app(get("init").elements, "ant"), "moose"), "snake"),
      )
      .seq("AAAA", (_) =>
        _.std.const({ one: "DOG", two: _.get("init").another }),
      )
      .seq("add_animal", (_) =>
        _.s1.addAnimal({
          initArray: _.get("init").elements,
          newAnimal: "CAT",
        }),
      )
      .output((_) => ({
        added: _.get("add_animal"),
        appended: _.get("append"),
      }));

    return {
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

const r = await r0.run("test", { elements: ["dog"], another: "fish" }, [
  useLog(),
]);

console.log(r);

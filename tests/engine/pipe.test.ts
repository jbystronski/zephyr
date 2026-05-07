// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import {
  createModuleFactory,
  createRuntimeRoot,
} from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";
type S1 = {
  enrich: (input: string, add: string) => string;
  addAnimal: (input: { initArray: string[]; newAnimal: string }) => string[];
};

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

const createMod = createModuleFactory<{
  s1: S1;
  actions: (typeof registryA)["actions"];
}>();

const testPipe = createMod({
  define: ({ wf }) => {
    const findFirstArcticBird = wf<{ data: Transformable[] }>(
      "firstArcticBirdTest",
    )
      .init("i")
      .pipe(
        "firstArctictBird",
        "find",
        ({ get }) => get("i").data,
        (b) =>
          b
            .init("animal")
            .eval("first", ({ get, and, eq }) =>
              and(
                eq(get("animal").kind, "bird"),
                eq(get("animal").climate, "arctic"),
              ),
            ),
      )
      .output(({ get }) => get("firstArctictBird"));

    const someAreTropical = wf<{ data: Transformable[] }>("someAreTropical")
      .init("i")
      .pipe(
        "someAreTropical",
        "some",
        ({ get }) => get("i").data,
        (b) =>
          b
            .init("animal")
            .eval("first", ({ get, and, eq }) =>
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
            .eval("first", ({ get, and, eq }) =>
              and(eq(get("animal").climate, "arctic")),
            ),
      )
      .output(({ get }) => get("everyIsArctic"));

    const reptilesOnly = wf<{ data: Transformable[] }>("reptilesOnly")
      .init("i")
      .pipe(
        "reptilesOnly",
        "filter",
        ({ get }) => get("i").data,
        (b) =>
          b
            .init("animal")
            .eval("first", ({ get, and, eq }) =>
              and(eq(get("animal").kind, "reptile")),
            ),
      )
      .output(({ get }) => get("reptilesOnly"));

    const test = wf<{ elements: string[]; another: string }>("pipeElements")
      .init("init")
      .seq("add_animal", "s1", "addAnimal", (ctx) =>
        ctx.args({
          initArray: ctx.get("init").elements,
          newAnimal: ctx.get("init").another,
        }),
      )

      .pipe(
        "pv2",
        "map",
        ({ get }) => get("add_animal"),
        (b) =>
          b
            .init("pv2_init")
            .seq("upp", "actions", "uppercase", (ctx) =>
              ctx.args(ctx.get("pv2_init")),
            )
            .seq("pref", "actions", "addPrefix", ({ args, get }) =>
              args(get("upp"), "<"),
            )
            .seq("suffix", "actions", "addSuffix", ({ args, get }) =>
              args(get("pref"), ">"),
            )
            .seq("enrich", "s1", "enrich", ({ args, get }) =>
              args(get("suffix"), "!"),
            ),
      )

      .output(({ get }) => get("pv2"));

    return {
      test,
      findFirstArcticBird,
      someAreTropical,
      everyIsArctic,
      reptilesOnly,
    };
  },
});

const r0 = createRuntimeRoot({
  module: testPipe,
  services: {
    ...registryA,
    s1: {
      enrich: (input: string, add: string) => input + add,
      addAnimal: (input: { initArray: string[]; newAnimal: string }) => {
        const newArr = [...input.initArray, input.newAnimal];
        return newArr;
      },
    },
  },
});

describe("Pipe", () => {
  it("should execute pipe and return result", async () => {
    const res = await r0.run(
      "test",
      {
        elements: ["cat", "dog", "bird"],
        another: "fish",
      },
      [useLog()],
    );

    expect(res.output).toEqual(["<CAT>!", "<DOG>!", "<BIRD>!", "<FISH>!"]);
  });

  it("should return first matching result from pipe", async () => {
    const r = await r0.run("findFirstArcticBird", { data: transformables });

    expect(r.output).toEqual({
      name: "penguin",
      kind: "bird",
      climate: "arctic",
    });
  });

  it("should evaluate some pipe condtion to true", async () => {
    const r = await r0.run("someAreTropical", { data: transformables });

    expect(r.output).toBe(true);
  });

  it("should evaluate every pipe condtion to false", async () => {
    const r = await r0.run("everyIsArctic", { data: transformables });

    expect(r.output).toBe(false);
  });

  it("should filter reptiles", async () => {
    const r = await r0.run("reptilesOnly", { data: transformables });

    expect(r.output).toEqual([
      {
        climate: "tropical",
        kind: "reptile",
        name: "crocodile",
      },
      {
        climate: "moderate",
        kind: "reptile",
        name: "steppe tortoise",
      },
    ]);
  });
});

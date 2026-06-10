// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { buildWF } from "../../src";

import {
  baseServices,
  createRuntime,
  StandardServices,
  useLog,
} from "../../src";
type S1 = {
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

const wf = buildWF<
  StandardServices & {
    s1: S1;
  }
>();

const findFirstArcticBird = wf<{ i: { data: Transformable[] } }>((_) => ({
  firstBird: _.PIPE(
    "find",
    _.steps.i.data,
    {},
    wf((_) => ({
      out: _.logic.and(
        _.logic.eq(_.steps.i.item.kind, "bird"),
        _.logic.eq(_.steps.i.item.climate, "arctic"),
      ),
    })),
  ),
  out: _.steps.firstBird,
}));

const someAreTropical = wf<{ i: { data: Transformable[] } }>((_) => ({
  some: _.PIPE(
    "some",
    _.steps.i.data,
    {},
    wf((_) => ({
      out: _.logic.eq(_.steps.i.item.climate, "tropical"),
    })),
  ),
  out: _.steps.some,
}));

const everyIsArctic = wf<{ i: { data: Transformable[] } }>((_) => ({
  every: _.PIPE(
    "every",
    _.steps.i.data,
    {},
    wf((_) => ({
      out: _.logic.eq(_.steps.i.item.climate, "arctic"),
    })),
  ),
  out: _.steps.every,
}));

const reptilesOnly = wf<{ i: { data: Transformable[] } }>((_) => ({
  filter: _.PIPE(
    "filter",
    _.steps.i.data,
    {},
    wf((_) => ({
      out: _.logic.eq(_.steps.i.item.kind, "reptile"),
    })),
  ),
  out: _.steps.filter,
}));

const test = wf<{ i: { elements: string[]; another: string } }>((_) => ({
  add: _.s1.addAnimal({
    initArray: _.steps.i.elements,
    newAnimal: _.steps.i.another,
  }),
  pv2: _.PIPE(
    "map",
    _.steps.add,
    {},
    wf((_) => ({
      upp: _.string.upper(_.steps.i.item),
      pref: _.std.concat("<", _.steps.upp),
      suffix: _.std.concat(_.steps.pref, ">"),
      out: _.std.concat(_.steps.suffix, "!"),
    })),
  ),
  out: _.steps.pv2,
}));

const s = baseServices
  .add("s1", {
    addAnimal: (input: { initArray: string[]; newAnimal: string }) => {
      const newArr = [...input.initArray, input.newAnimal];
      return newArr;
    },
  })

  .build();

const r0 = createRuntime({ services: s });

describe("Pipe", () => {
  it("should execute pipe and return result", async () => {
    const res = await r0.exec(test, {
      elements: ["cat", "dog", "bird"],
      another: "fish",
    });

    expect(res.output).toEqual(["<CAT>!", "<DOG>!", "<BIRD>!", "<FISH>!"]);
  });

  it("should return first matching result from pipe", async () => {
    const r = await r0.exec(findFirstArcticBird, {
      data: transformables,
    });

    expect(r.output).toEqual({
      name: "penguin",
      kind: "bird",
      climate: "arctic",
    });
  });

  it("should evaluate some pipe condtion to true", async () => {
    const r = await r0.exec(someAreTropical, {
      data: transformables,
    });

    expect(r.output).toBe(true);
  });

  it("should evaluate every pipe condtion to false", async () => {
    const r = await r0.exec(everyIsArctic, {
      data: transformables,
    });

    expect(r.output).toBe(false);
  });

  it("should filter reptiles", async () => {
    const r = await r0.exec(reptilesOnly, {
      data: transformables,
    });

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

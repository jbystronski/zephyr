import { createModuleFactory, createRuntimeRoot } from "../src/workflow-module";
import { eventStream, StandardServices, useLog } from "../src";

import { baseServices, createServices } from "../src/utils";
import { arrayLib, dateLib, stdLib, stringLib } from "../src/services";
type S1 = {
  enrich: (input: string, add: string) => string;
  addAnimal: (input: { initArray: string[]; newAnimal: string }) => string[];

  transform: (v: any, predicate: any) => any;
  predicateFn: () => any;
};
export const registryA = {
  add: (a: number, b: number) => a + b,
  sum: (input: { a: number; b: number }) => input.a + input.b,
  double: (n: number) => n * 2,
  addSuffix: (input: string, suffix: string) => input + suffix,
  addPrefix: (input: string, prefix: string) => prefix + input,
  uppercase: (input: string) => input.toUpperCase(),
  log: (input: { v: string }) => {
    console.log(input.v);
  },
  noInput: () => {
    console.log("no input");
  },
  transform: (o: Record<string, any>) => o,
};

eventStream.subscribe((ev: any) => {
  console.dir(ev, { depth: 3 });
});

type Transformable = {
  kind: "mammal" | "reptile" | "bird";
  name: string;
  climate: "tropical" | "arctic" | "moderate";
  value: number;
};

const transformables: Transformable[] = [
  {
    kind: "mammal",
    climate: "moderate",
    name: "boar",
    value: 0,
  },
  {
    kind: "reptile",
    climate: "tropical",
    name: "crocodile",
    value: 0,
  },
  {
    name: "penguin",
    kind: "bird",
    climate: "arctic",
    value: 0,
  },
  { name: "sparrow", kind: "bird", climate: "moderate", value: 0 },
  {
    kind: "mammal",
    climate: "tropical",
    name: "elephant",
    value: 0,
  },
  {
    kind: "mammal",
    climate: "moderate",
    name: "wolf",

    value: 0,
  },
  {
    kind: "mammal",
    climate: "moderate",
    name: "elk",
    value: 0,
  },
  {
    kind: "reptile",
    climate: "moderate",
    name: "steppe tortoise",
    value: 0,
  },
  {
    kind: "bird",
    climate: "tropical",
    name: "parrot",
    value: 0,
  },
];

type Entity = { animal: string; nums: number[] };

const createMod = createModuleFactory<
  { s1: S1; actions: typeof registryA } & StandardServices
>();

const bMod = createMod({
  define: ({ wf }) => ({
    b: wf<{ bInputStr: string; bElemenets: string[] }>("b")
      .init("i")
      .seq("b_0", (_) => _.actions.addSuffix(_.get("i").bInputStr, ">>"))
      // .pipe(
      //   "pipe in b",
      //   "map",
      //   ({ get }) => get("i").bElemenets,
      //   (b) =>
      //     b
      //       .init("b_item")
      //       .seq("upp", "actions", "uppercase", ({ args, get }) =>
      //         args(get("b_item")),
      //       ),
      // )
      .output(({ get }) => get("b_0")),
  }),
});

const sumMod = createMod({
  define: ({ wf }) => ({
    sum: wf<{ a: number; b: number }>("sum")
      .init("sum")
      .seq("add", (ctx) => {
        return ctx.actions.add(ctx.get("sum").a, ctx.get("sum").b);
      })
      .output((ctx) => ctx.get("add")),
  }),
});

const testPipe = createMod({
  // use: { subMod },
  // expose: { addition: "subMod.subA" },
  use: { b: bMod, c: sumMod },
  define: ({ wf }) => {
    const c = wf<{
      stringA: string;
      numberA: number;
      elements: string[];
      suf: string;
    }>("c")
      .init("init")
      .sub("b_sub", "b.b", ({ get }) => ({
        bInputStr: get("init").stringA,
        bElemenets: get("init").elements,
      }))

      .sub("c_sub", "b.b", ({ get }) => ({
        bInputStr: get("init").stringA,
        bElemenets: get("init").elements,
      }))

      .output(({ get }) => ({
        subRes: get("b_sub"),
      }));

    const reptilesOnly = wf<{ data: Transformable[] }>("reptilesOnly")
      .init("i")
      .pipe(
        "reptilesOnly",
        "filter",
        ({ get }) => get("i").data,
        (b) =>
          b
            .init("animal")
            .seq("first", ({ get, logic_std: { and, eq } }) =>
              and(eq(get("animal").kind, "reptile")),
            ),
      )
      .output(({ get }) => get("reptilesOnly"));

    const skipSumTest = wf("skipSumTest")
      .if(
        "true is false",
        (ctx) => ctx.logic_std.eq(true, true),
        (b) =>
          b
            .subflow("result", "c.sum", () => ({ a: 2, b: 3 }))
            .pipe(
              "cond pipe",
              "map",
              () => [1, 2, 3],
              (b) =>
                b
                  .init("num")
                  .seq("op 1", ({ get, math_std }) =>
                    math_std.mul(get("num"), 4),
                  ),
            ),
      ) // ❌ skip subflow

      .output(({ get }) => ({ a: get("result"), b: get("cond pipe") }));

    return { c, reptilesOnly, skipSumTest };
    // return { test, pipe, c };
  },
});

const finalServices = baseServices
  .add("actions", registryA)
  .add("s1", {
    enrich: (input: string, add: string) => input + add,
    transform: (v: any, predicate: any) => {
      if (typeof predicate === "function") {
        return predicate(v);
      }

      return v;
    },
    predicateFn: () => {
      return (v: string) => v.toUpperCase();
    },
    addAnimal: (input: { initArray: string[]; newAnimal: string }) => {
      const newArr = [...input.initArray, input.newAnimal];
      return newArr;
    },
  })
  .build();

const s = {
  actions: registryA,
  s1: {
    enrich: (input: string, add: string) => input + add,
    addAnimal: (input: { initArray: string[]; newAnimal: string }) => {
      const newArr = [...input.initArray, input.newAnimal];
      return newArr;
    },
  },
};
// console.dir(testPipe.__public.skipSumTest, { depth: 16 });

// const rt = createRuntimeRoot({
//   module: testPipe,
//   services: finalServices,
// });

///////////////////////////////////////////
//
//

type ExplorerObject = {
  label: string;
  parent?: ExplorerObject;
  type: "root" | "leaf" | "branch";
  raw: {
    name: string;
    kind: string;
  };
};

const mod = createModuleFactory<StandardServices>();

const modB = mod({
  define: ({ wf }) => ({
    createExplorerObject: wf<{ key: string; parent?: ExplorerObject }>(
      "create explorer object",
    )
      .init("i")
      .seq("created", ({ std, get }) =>
        std.const({
          label: get("i").key,
          parent: get("i").parent,
          type: std.if(get("i").parent, "branch", "root"),
          raw: {
            name: get("i").key,
            kind: "bucket",
          },
        }),
      )
      .as<ExplorerObject>()
      .output(({ get }) => get("created")),

    findObject: wf<{ data: ExplorerObject[]; key: string }>("find obejct")
      .init("i")
      .if(
        "key exists",
        ({ logic_std, get }) => logic_std.truthy(get("i").key),
        (b) =>
          b.pipe(
            "find pipe",
            "find",
            (_) => _.get("i").data,
            (b) =>
              b
                .init("item")
                .seq("match label", (_) =>
                  _.logic_std.eq(_.get("i").key, _.get("item").label),
                ),
          ),
      )

      .output(({ get }) => ({
        found: get("find pipe"),
      })),
  }),
});

const modA = mod({
  use: { modB },
  expose: { findObject: "modB.findObject" },
  define: ({ wf }) => ({
    createObjects: wf<{ initData: { label: string; kind: string }[] }>(
      "create objects",
    )
      .init("i1")
      .pipe(
        "p 1",
        "map",
        (_) => _.get("i1").initData,
        (b) =>
          b
            .init("item")
            .sub("new object", "modB.createExplorerObject", ({ get }) => ({
              key: get("item").label,
            })),
      )
      .as<ExplorerObject[]>()
      .output(({ get }) => ({
        objects: get("p 1"),
      })),
  }),
});

const modC = mod({
  use: { modA },
  define: ({ wf }) => ({
    createObjectsAndFind: wf<{
      keyToFind: string;
      initData: { label: string; kind: string }[];
    }>("create object and find by key")
      .init("i0")
      .sub("created objects", "modA.createObjects", ({ get }) => ({
        initData: get("i0").initData,
      }))

      .output(({ get }) => ({
        objects: get("created objects"),
      })),
  }),
});

const services = baseServices.build();

// const modAruntime = createRuntimeRoot({
//   module: modA,
//   services,
// });
//
const modCruntime = createRuntimeRoot({
  module: modC,
  services,
});

console.dir(modC.workflows.createObjectsAndFind, { depth: 15 });

// const testOne = await modAruntime.run("createObjects", {
//   initData: [
//     { kind: "bucket", label: "emails" },
//     { kind: "bucket", label: "configs" },
//   ],
// });

const testTwo = await modCruntime.run(
  "createObjectsAndFind",
  {
    initData: [
      { kind: "bucket", label: "emails" },
      { kind: "bucket", label: "configs" },
    ],
    keyToFind: "emails",
  },
  [useLog()],
);

console.dir(testTwo, { depth: 16 });

const modAlt = createModuleFactory<StandardServices>();

const modX = modAlt({
  use: {
    local: modAlt({
      define: ({ wf }) => ({
        subOne: wf<{ items: string[] }>("sub one")
          .init("i")
          .pipe(
            "pipe prefix",
            "map",
            (_) => _.get("i").items,
            (b) =>
              b
                .init("with prefix")
                .seq("add pref", (_) =>
                  _.std.concat("!!", _.get("with prefix")),
                ),
          )
          .output((_) => _.get("pipe prefix")),
      }),
    }),
  },
  define: ({ wf }) => ({
    two: wf<{ items: string[] }>("two")
      .init("i")
      .pipe(
        "pipe",
        "map",
        (_) => _.get("i").items,
        (b) =>
          b
            .init("to process")
            .seq("upp", (_) => _.string_std.upper(_.get("to process"))),
      )
      .sub("subflow add prefix to items", "local.subOne", (_) => ({
        items: _.get("i").items,
      }))
      .output((_) => ({
        topPipe: _.get("pipe"),
        subPipe: _.get("subflow add prefix to items"),
      })),
  }),
});

// console.dir(modC.__public.createObjectsAndFind, { depth: 16 });

const modXruntime = createRuntimeRoot({
  module: modX,
  services: baseServices.build(),
});

// const r = await modXruntime.run(
//   "two",
//   {
//     items: ["dog", "cat", "fish"],
//   },
//   [useLog()],
// );

// console.log(r);

// const r = await modCruntime.run("testArray", {}, [useLog()]);
//
// console.log("r", r);

// console.log(testTwo.output);

// console.dir(modC.workflows.testNewIfElse, { depth: 16 });
//
// const testThree = await modCruntime.run("testNewIfElse", { input: "DOG" });
//
// console.log("test three res", testThree);

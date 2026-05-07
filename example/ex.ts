import { createModuleFactory, createRuntimeRoot } from "../src/workflow-module";
import { eventStream, StandardServices, useLog } from "../src";
import test from "node:test";
import { get } from "node:http";
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
      .seq("b_0", "actions", "addSuffix", ({ get, args }) =>
        args(get("i").bInputStr, ">>"),
      )
      .pipe(
        "pipe in b",
        "map",
        ({ get }) => get("i").bElemenets,
        (b) =>
          b
            .init("b_item")
            .seq("upp", "actions", "uppercase", ({ args, get }) =>
              args(get("b_item")),
            ),
      )
      .output(({ get }) => get("b_0")),
  }),
});

const sumMod = createMod({
  define: ({ wf }) => ({
    sum: wf<{ a: number; b: number }>("sum")
      .init("sum")
      .seq("add", "actions", "add", (ctx) => {
        return ctx.args(ctx.get("sum").a, ctx.get("sum").b);
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
      .ifElse(
        "numberA equals 12",
        ({ get, eq }) => eq(get("init").numberA, 12),
        (b) =>
          b.seq("double_A", "actions", "double", ({ get, args }) =>
            args(get("init").numberA),
          ),
        (b) =>
          b.seq("add_A", "actions", "add", ({ get, args }) =>
            args(get("init").numberA, 22),
          ),
      )

      .output(({ get }) => ({
        subRes: get("b_sub"),
        addA: get("add_A"),
        doubleA: get("double_A"),
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
            .eval("first", ({ get, and, eq }) =>
              and(eq(get("animal").kind, "reptile")),
            ),
      )
      .output(({ get }) => get("reptilesOnly"));

    const skipSumTest = wf("skipSumTest")
      .if(
        "true is false",
        (ctx) => ctx.eq(true, true),
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
                  .seq("op 1", "math_std", "mul", ({ get, args }) =>
                    args(get("num"), 4),
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

const rt = createRuntimeRoot({
  module: testPipe,
  services: finalServices,
});

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
      .seq("type of object", "std", "if", ({ args, get }) =>
        args(get("i").parent, "branch", "root"),
      )
      .seq("created", "std", "const", ({ args, get }) =>
        args({
          label: get("i").key,
          parent: get("i").parent,
          type: get("type of object"),
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
        ({ truthy, get }) => truthy(get("i").key),
        (b) =>
          b
            // .seq("some if dependant", "math_std", "mul", ({ args, get }) =>
            //   args(2, 4),
            // )
            // .seq("SECOND", "math_std", "mul", ({ args, get }) => args(2, 4))

            .pipe(
              "find pipe",
              "find",
              ({ get }) => get("i").data,
              (b) =>
                b
                  .init("item")
                  .eval("match label", ({ get, eq }) =>
                    eq(get("i").key, get("item").label),
                  ),
            ),
      )
      // .pipe(
      //   "find pipe 2",
      //   "find",
      //   ({ get }) => get("i").data,
      //   (b) =>
      //     b
      //       .init("item 2")
      //       .eval("match label 2", ({ get, eq }) =>
      //         eq(get("i").key, get("item 2").label),
      //       ),
      // )

      .output(({ get }) => ({
        found: get("find pipe"),
      })),
  }),
});

const modA = mod({
  use: { modB },
  expose: { findObject: "modB.findObject" },
  define: ({ wf }) => ({
    modAWF1: wf<{ input: number }>("mod A WF 1")
      .init("i")
      .seq("local", "math_std", "mul", ({ args, get }) =>
        args(get("i").input, 333),
      )
      .output(({ get }) => get("local")),
    createObjects: wf<{ initData: { label: string; kind: string }[] }>(
      "create objects",
    )
      .init("i")
      .pipe(
        "p 1",
        "map",
        ({ get }) => get("i").initData,
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
    testNewIfElse: wf<{ input: string }>("test new if else")
      .init("i")
      .ifElse(
        "string equals DOG",
        ({ get, eq }) => eq(get("i").input, "DOG"),
        (b) =>
          b
            .seq("double", "math_std", "mul", ({ args: _, get: $ }) => _(10, 2))
            .seq("join a", "std", "concat", ({ args: _, get: $ }) =>
              _("Input is ", $("i").input, " number is ", $("double")),
            ),
        (b) =>
          b
            .seq("double", "math_std", "mul", ({ args: _, get: $ }) =>
              _(100, 2),
            )
            .seq("join b", "std", "concat", ({ args: _, get: $ }) =>
              _("Input is ", $("i").input, " number is ", $("double")),
            ),
      )

      .sub("from sub", "modA.modAWF1", () => ({ input: 15 }))
      .seq("local", "math_std", "mul", ({ args, get }) => args(10, 20))
      .seq("join", "std", "coalesce", ({ args, get }) =>
        args(get("join a"), get("join b")),
      )
      .output(({ get }) => ({ a: get("join"), b: get("local") })),
    createObjectsAndFind: wf<{
      keyToFind: string;
      initData: { label: string; kind: string }[];
    }>("create object and find by key")
      .init("i")
      // .seq("add", "math_std", "add", ({ args }) => args(4, 222))
      // .if(
      //   "2 eq 3",
      //   ({ get, eq }) => eq(2, 3),
      //   (b) =>
      //     b.seq(
      //       "some conditional top node",
      //       "math_std",
      //       "add",
      //       ({ get, args }) => args(4, 1),
      //     ),
      // )
      .sub("created objects", "modA.createObjects", ({ get }) => ({
        initData: get("i").initData,
      }))

      .sub("find", "modA.findObject", ({ get }) => ({
        data: get("created objects").objects,
        key: get("i").keyToFind,
      }))
      .output(({ get }) => ({
        found: get("find").found,
      })),
  }),
});

const services = baseServices.build();

const modAruntime = createRuntimeRoot({
  module: modA,
  services,
});

const modCruntime = createRuntimeRoot({
  module: modC,
  services,
});

// console.dir(modC.workflows.createObjectsAndFind, { depth: 15 });

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

console.dir(modC.__public.createObjectsAndFind, { depth: 16 });

console.log(testTwo.output);

// console.dir(modC.workflows.testNewIfElse, { depth: 16 });
//
// const testThree = await modCruntime.run("testNewIfElse", { input: "DOG" });
//
// console.log("test three res", testThree);

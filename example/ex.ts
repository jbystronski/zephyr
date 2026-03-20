import { defineNode, TasksFromFns, useLog } from "../src/index.js";
import { WF } from "../src/types.js";

import { executeWorkflow } from "../src/workflow-executor.js";
import { createModule } from "../src/workflow-module.js";
import { opsRegistry, subReg, uppercase } from "./reg";

type BaseCtx = {
  indexMap: Map<string, string>;
  defString: string;
};
// const wf = createWorkflow(registry, context)("processItems");
//
// wf.seq("start", "fetchItems")
//   .forEach(
//     "processEachItem",
//     ctx => ctx.results.start,       // items array from previous step
//     "processItem",                 // action to run for each item
//     ({ item }) => [item]           // resolve args for action
//   )
//   .join("mergeResults", "combine", ctx => [ctx.results.processEachItem])
//   .output(ctx => ctx.results);

export const regOne = {
  uppercase: async ({ text }: { text: string }) => text.toUpperCase(),
  double: (n: number) => n * 2,
  lowercase: (v: string) => v.toLowerCase(),
  addSuffix: (v: string, suffix: string) => v + suffix,

  justLog: async () => {
    console.log("check");
  },
};

const modWithLoop = createModule({
  registry: regOne,
  context: {},
  define: ({ wf, deps, loop, args }) => {
    const loopWorkflow = wf<{ items: string[] }>("loop")
      .seq("results", "lowercase", (ctx) => loop(ctx.input.items.map(args)), {
        loop: true,
      })

      .output((ctx) => ctx.results.results);

    return {
      loopWorkflow,
    };
  },
});

const loopRes = await executeWorkflow(modWithLoop.loopWorkflow, regOne, {
  items: ["APPLE", "ORANGE", "BANANA"],
});

console.log("LOOP", loopRes);

// const upTest = await executeWorkflow(modWithLoop.uppercase, regOne, {
//   v: "dog",
// });
//
// console.log("loopREs", upTest);

export const modA = createModule({
  registry: regOne,
  context: { suffix: "!" }, // example of context
  define: ({ wf, deps, obj }) => {
    const jl = wf("jl").seq("#l", "justLog").build();
    const a1 = wf<{ value: string; another: number }>("a1")
      .seq("upper", "uppercase", (ctx) => obj({ text: ctx.input.value }))

      .seq("addSuffix", "uppercase", (ctx) => obj({ text: ctx.input.value }))

      .output((ctx) => ({ result: ctx.results.addSuffix }));

    return { jl, a1 };
  },
});

// --- STEP 3: Module B reuses Module A flows ---
export const modB = createModule({
  registry: regOne,
  context: { multiplier: 2 }, // B-specific context
  use: [modA] as const, // 👈 reuse A flows
  define: ({ wf, deps, args }) => ({
    b1: wf<{ value: string }>("b1")
      .subflow("aFlowPre", deps.jl)
      .subflow("aFlow", deps.a1, () => ({ value: "a", another: 22 }))
      .seq("doubleLength", "double", (ctx) =>
        args(ctx.results.aFlow.result.length * ctx.context.multiplier),
      )
      .output((ctx) => ({ result: ctx.results.aFlow.result })),
  }),
});

// --- STEP 4: Module C reuses Module B flows ---
export const modC = createModule({
  registry: regOne,
  context: { prefix: ">>" }, // C-specific context
  use: [modB],
  define: ({ wf, deps, args }) => ({
    lower: wf<{ v: string }>("lower")
      .seq("lw", "lowercase", (ctx) => args(ctx.input.v))
      .parallel((b) => b.seq("p1", "lowercase", (ctx) => args(ctx.results.lw)))
      .when((ctx) => ctx.results.lw === "ABC")
      .seq("lw2", "lowercase", (ctx) => args(ctx.results.lw))
      .output((ctx) => ctx.results.lw),
    c1: wf<{ value: string }>("c1")
      .subflow("bFlow", deps.b1, (ctx) => ({ value: ctx.input.value }))

      .output((ctx) => ({
        lCase: ctx.results.bFlow.result,
      })),
  }),
});

import { createRunner, useLog } from "../src/index.js";
import { WF } from "../src/types.js";

import { executeWorkflow } from "../src/workflow-executor.js";
import { createModule } from "../src/workflow-module.js";
import { opsRegistry, subReg, uppercase } from "./reg";

type BaseCtx = {
  indexMap: Map<string, string>;
  defString: string;
};

export const regOne = {
  uppercase: async ({ text }: { text: string }) => text.toUpperCase(),
  double: (n: number) => n * 2,
  lowercase: (v: string) => v.toLowerCase(),
  addSuffix: (v: string, suffix: string) => v + suffix,
  noop: () => {},
  justLog: async () => {
    console.log("check");
  },
};

const modWithLoop = createModule({
  registry: regOne,
  context: {},
  define: ({ wf, deps }) => {
    const uppercase = wf<{ v: string }>("uppercase")
      .seq("a", "uppercase", (ctx) => ctx.obj({ text: ctx.input.v }))
      .output((ctx) => ctx.results.a);
    const loopWorkflow = wf<{ items: string[] }>("loop")
      .seq("results", "lowercase", (ctx) =>
        ctx.loop(ctx.input.items.map((item) => ctx.args(item))),
      )

      .output((ctx) => ctx.results.results);

    return {
      loopWorkflow,
      uppercase,
    };
  },
});

const runner = createRunner(regOne);

const r1 = await runner(
  modWithLoop.loopWorkflow,
  { items: ["BERRY", "APPEL"] },
  [useLog()],
);

const loopRes = await executeWorkflow(modWithLoop.loopWorkflow, regOne, {
  items: ["APPLE", "ORANGE", "BANANA"],
});

console.log("LOOP", loopRes);

const upTest = await executeWorkflow(modWithLoop.uppercase, regOne, {
  v: "dog",
});

console.log("loopREs", upTest);

export const modA = createModule({
  registry: regOne,
  context: { suffix: "!" }, // example of context
  define: ({ wf, deps }) => {
    const jl = wf("jl").seq("#l", "justLog").build();
    const a1 = wf<{ value: string; another: number }>("a1")
      .seq("upper", "uppercase", (ctx) => ctx.obj({ text: ctx.input.value }))

      .seq("addSuffix", "uppercase", (ctx) => ctx.obj({ text: "22" }))

      // .as<number>()

      .parallel((b1) =>
        b1.seq("b1", "uppercase", (ctx) =>
          ctx.obj({ text: ctx.results.addSuffix }),
        ),
      )
      .join("join", "noop", (ctx) => {
        return ctx.none();
      })
      .output((ctx) => ({
        result: ctx.results.addSuffix,
        parRes: ctx.results.b1,
      }));

    const a2 = wf<{ v: string }>("a2")
      .subflow("asub", a1, (ctx) => ({ value: "foo", another: 22 }))
      .output((ctx) => ({ res: ctx.results.asub.result }));
    return { jl, a1 };
  },
});

// --- STEP 3: Module B reuses Module A flows ---
export const modB = createModule({
  registry: regOne,
  context: { multiplier: 2 }, // B-specific context
  use: [modA] as const, // 👈 reuse A flows
  define: ({ wf, deps }) => ({
    b1: wf<{ value: string }>("b1")
      .subflow("aFlowPre", deps.jl, (ctx) => ({}))
      .subflow("aFlow", deps.a1, () => ({ value: "a", another: 2 }))
      .seq("doubleLength", "double", (ctx) => ctx.args(300))
      .output((ctx) => ({ result: ctx.results.aFlow.result })),
  }),
});

// --- STEP 4: Module C reuses Module B flows ---
export const modC = createModule({
  registry: regOne,
  context: { prefix: ">>" }, // C-specific context
  use: [modB],
  define: ({ wf, deps }) => ({
    lower: wf<{ v: string }>("lower")
      .seq("lw", "lowercase", (ctx) => ctx.args(ctx.input.v))
      .parallel((b) =>
        b.seq("p1", "lowercase", (ctx) => ctx.args(ctx.results.lw)),
      )
      .when((ctx) => ctx.results.lw === "ABC")
      .seq("lw2", "lowercase", (ctx) => ctx.args(ctx.results.lw))
      .output((ctx) => ctx.results.lw),
    c1: wf<{ value: string }>("c1")
      .subflow("bFlow", deps.b1, (ctx) => ({ value: ctx.input.value }))

      .output((ctx) => ({
        lCase: ctx.results.bFlow.result,
      })),
  }),
});

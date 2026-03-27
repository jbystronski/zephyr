import { createActionRegistry, createRuntime, useLog } from "../src/index.js";

import { executeWorkflow } from "../src/workflow-executor.js";
import { createModule, createModuleFactory } from "../src/workflow-module.js";
import { opsRegistry, subReg, uppercase } from "./reg";

// type BaseCtx = {
//   indexMap: Map<string, string>;
//   defString: string;
// };
//
export const regOne = {
  uppercase: async ({ text }: { text: string }) => text.toUpperCase(),
  double: (n: number) => n * 2,
  lowercase: (v: string) => v.toLowerCase(),
  addSuffix: (v: string, suffix: string) => v + suffix,
  noop: () => {},
  justLog: async (v: any) => {
    console.log(v);
  },
};
//
// const modWithLoop = createModule({
//   registry: regOne,
//   context: {},
//   define: ({ wf, deps }) => {
//     const uppercase = wf<{ v: string }>("uppercase")
//       .seq("a", "uppercase", (ctx) => ctx.obj({ text: ctx.input.v }))
//       .output((ctx) => ctx.results.a);
//     const loopWorkflow = wf<{ items: string[] }>("loop")
//       .seq("results", "lowercase", (ctx) =>
//         ctx.loop(ctx.input.items.map((item) => ctx.args(item))),
//       )
//
//       .output((ctx) => ctx.results.results);
//
//     return {
//       loopWorkflow,
//       uppercase,
//     };
//   },
// });
//
// const modWithLoopRunner = createModuleRunner(modWithLoop, regOne);
//
// const r0 = await modWithLoopRunner("loopWorkflo", { items: [] });
// const runner = createRunner(regOne);
// const r1 = await runner(
//   modWithLoop.loopWorkflow,
//   { items: ["BERRY", "APPEL"] },
//   [useLog()],
// );
//
// const loopRes = await executeWorkflow(modWithLoop.loopWorkflow, regOne, {
//   items: ["APPLE", "ORANGE", "BANANA"],
// });
//
// console.log("LOOP", loopRes);
//
// const upTest = await executeWorkflow(modWithLoop.uppercase, regOne, {
//   v: "dog",
// });
//
// console.log("loopREs", upTest);
//
// export const modA = createModule({
//   registry: regOne,
//   context: { suffix: "!" }, // example of context
//   define: ({ wf, deps }) => {
//     const ja = wf("jl")
//       .seq("#l", "justLog")
//       .seq("j1_upp", "uppercase", (ctx) => ctx.obj({ text: "cat" }))
//       .output((ctx) => ({ ja_result: ctx.results.j1_upp }));
//     const a1 = wf<{ value: string; another: number }>("a1")
//       .seq("upper", "uppercase", (ctx) => ctx.obj({ text: ctx.input.value }), {
//         onError: (err, ctx) => {
//           throw Error(err);
//         },
//       })
//       .as<string>()
//       .seq("xyz", "uppercase", (ctx) => ctx.obj({ text: ctx.input.value }))
//       .when((ctx) => true)
//       .seq("condA", "addSuffix", (ctx) => ctx.args("one", "!!!"))
//       .as<string | undefined>()
//       .endWhen()
//       .subflow("subA", ja, (ctx) => ({}))
//
//       .parallel(
//         (b1) =>
//           b1
//             .seq("b1_action", "uppercase", (ctx) => ctx.obj({ text: "ssss" }))
//             .parallel((b0) =>
//               b0.seq("deep_action", "justLog", (ctx) => ctx.args("deep")),
//             )
//             .join("deepJoin", "justLog", (ctx) =>
//               ctx.args(ctx.results.deep_action),
//             ),
//
//         (b2) => b2.seq("logB", "justLog", (ctx) => ctx.args("B")),
//       )
//       .join("joinConditions", "uppercase", (ctx) =>
//         ctx.obj({ text: ctx.results.b1_action }),
//       )
//       .seq("addSuffix", "uppercase", (ctx) => ctx.obj({ text: "22" }))
//       .as<string | undefined>()
//
//       .parallel((nextParrall) =>
//         nextParrall.seq("kkkkkkkkkkkk", "uppercase", (ctx) =>
//           ctx.obj({ text: ctx.results.addSuffix }),
//         ),
//       )
//       .join("join", "uppercase", (ctx) => {
//         return ctx.obj({ text: ctx.results.b1_action });
//       })
//       .output((ctx) => ({
//         parRes: ctx.results.deep_action,
//         subflowRes: ctx.results.subA.ja_result,
//         optResult: ctx.results.condA,
//       }));
//
//     return { ja, a1 };
//   },
// });
//
// // --- STEP 3: Module B reuses Module A flows ---
// export const modB = createModule({
//   registry: regOne,
//   context: { multiplier: 2 }, // B-specific context
//   use: { moduleA: modA },
//   define: ({ wf, deps }) => ({
//     b1: wf<{ value: string }>("b1")
//       .subflow("aFlowPre", deps.moduleA.own.ja, (ctx) => ({}))
//       .subflow("aFlow", deps.moduleA.own.a1, () => ({ value: "a", another: 2 }))
//       .seq("doubleLength", "double", (ctx) => ctx.args(300))
//       .output((ctx) => ({ result: "abc" })),
//   }),
// });
//
// // --- STEP 4: Module C reuses Module B flows ---
// export const modC = createModule({
//   registry: regOne,
//   context: { prefix: ">>" }, // C-specific context
//   use: { moduleB: modB },
//   define: ({ wf, deps }) => ({
//     lower: wf<{ v: string }>("lower")
//       .seq("lw", "lowercase", (ctx) => ctx.args(ctx.input.v))
//       .parallel((b) =>
//         b.seq("p1", "lowercase", (ctx) => ctx.args(ctx.results.lw)),
//       )
//       .when((ctx) => ctx.results.lw === "ABC")
//       .seq("lw2", "lowercase", (ctx) => ctx.args(ctx.results.lw))
//       .output((ctx) => ctx.results.lw),
//     c1: wf<{ value: string }>("c1")
//       .subflow("bFlow", deps.moduleB.own.b1, (ctx) => ({
//         value: ctx.input.value,
//       }))
//
//       .output((ctx) => ({
//         lCase: ctx.results.bFlow.result,
//       })),
//   }),
// });
//
const machineReg = createActionRegistry()
  .action("get_terrain", (context: MachineCtx) => {
    return context.terrain;
  })
  .build();

type MachineCtx = { terrain: string; type: string; singleton: () => boolean };
type AirplaneCtx = { maxAltitude: number; terrain: string; type: string };
type JetfighterCtx = { missileCapacity: number };
type MotorboatCtx = { color: string; terrain: string; type: string };
const createMachineMod = createModuleFactory<typeof machineReg, MachineCtx>();

const createAirplaneMod = createModuleFactory<typeof machineReg, AirplaneCtx>();
const createJetfighterMod = createModuleFactory<
  typeof machineReg,
  JetfighterCtx
>();

const createMotorboatMod = createModuleFactory<
  typeof machineReg,
  MotorboatCtx
>();
const machineMod = createMachineMod({
  define: ({ wf }) => {
    const getTerrain = wf("getTerrain")
      .seq("getTerrain", "get_terrain", (ctx) => ctx.args(ctx.context))
      .output((ctx) => ctx.results.getTerrain);

    return {
      getTerrain,
    };
  },
});

const airplaneMod = createAirplaneMod({
  use: { machine: machineMod },
  define: ({ wf, deps }) => {
    const getTerrain = wf("getTerrain")
      .subflow("getTerrain", deps.machine.own.getTerrain, (ctx) => ({}))

      .output((ctx) => ctx.results.getTerrain);

    return { getTerrain };
  },
});

const jetfighterMod = createJetfighterMod({
  use: { airplane: airplaneMod },
  define: ({ wf, deps }) => {
    return {};
  },
});

const motorboatMod = createMotorboatMod({
  use: { machine: machineMod },
  define: ({ wf, deps }) => {
    const getTerrain = wf("getTerrain")
      .subflow("getTerrain", deps.machine.own.getTerrain, (ctx) => ({}))

      .output((ctx) => ctx.results.getTerrain);

    return { getTerrain };
  },
});

const machineRt = machineMod.createRuntime({
  registry: machineReg,
  context: { terrain: "default", type: "machine", singleton: () => true },
});

const airplaneRt = airplaneMod.createRuntime({
  registry: machineReg,
  context: {
    ...machineRt.getContext(),
    terrain: "air",
    type: "plane",
    maxAltitude: 3000,
  },
});

const motorboatRt = motorboatMod.createRuntime({
  registry: machineReg,
  context: {
    ...machineRt.getContext(),
    color: "red",
    type: "motorboat",
    terrain: "water",
  },
});

const jetfighterRt = jetfighterMod.createRuntime({
  registry: machineReg,
  context: {
    ...airplaneRt.getContext(),

    missileCapacity: 4,
  },
});

const r0 = await airplaneRt.run(airplaneMod.deps.machine.own.getTerrain, {});

// const a1 = await executeWorkflow(
//   airplaneMod.deps.machine.own.getTerrain,
//   machineReg,
//   {},
//   [useLog()],
// );
//
// console.log(a1);
//
// const mRun = createRuntime(machineReg, { terrain: "air" });
//
// const r1 = await mRun.run(airplaneMod.deps.machine.own.getTerrain, {});

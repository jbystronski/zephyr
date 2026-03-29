import { createActionRegistry, eventStream, useLog } from "../src/index.js";

import { executeWorkflow } from "../src/workflow-executor.js";
import { createModuleFactory } from "../src/workflow-module.js";
import { opsRegistry, subReg, uppercase } from "./reg";

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
const machineReg = createActionRegistry("machine_")
  .action("get_terrain", (context: MachineCtx) => {
    return context.terrain;
  })
  .action("log", (value: string) => {
    console.log(value);
  })

  .action("action_b1", (v: string) => {
    console.log(v);

    return v.toUpperCase();
  })
  .action("action_b2", (v: string) => {
    console.log("VALUE TO LC: ", v);
    return v.toLowerCase();
  })
  .action("noop", () => {})
  .build();

const helicopterReg = createActionRegistry("helicopter_")
  .extend(machineReg)
  .action("loadCargo", (cargo: string[], loadCapacity: number) => {
    if (cargo.length > loadCapacity) {
      console.log("Too much load");
      return false;
    }
    return true;
  })
  .action("offGround", () => {
    console.log("starting");
  })
  .build();

const baloonReg = createActionRegistry("baloon_")
  .action("fly_away", () => {
    console.log("flying aways");
  })
  .build();

type MachineCtx = { terrain: string; type: string; singleton: () => boolean };
type AirplaneCtx = { maxAltitude: number; terrain: string; type: string };

type helicopterCtx = AirplaneCtx & { loadCapacity: number };
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
    const logValue = wf<{ input: string }>("logValue")
      .seq("log", "machine_log", (ctx) => ctx.args(ctx.input.input))
      .build();

    const getTerrain = wf("getTerrain")
      .seq("getTerrain", "machine_get_terrain", (ctx) => ctx.args(ctx.context))
      .output((ctx) => ctx.results.getTerrain);

    return {
      getTerrain,
      logValue,
    };
  },
});

const baloonMod = createModuleFactory<typeof baloonReg, {}>()({
  define: ({ wf }) => {
    const flywAway = wf("fly_away")
      .seq("fa", "baloon_fly_away", (ctx) => ctx.none())
      .output((ctx) => ({ msg: "flew away" }));
    return { flywAway };
  },
});

const airplaneMod = createAirplaneMod({
  use: { machine: machineMod },
  define: ({ wf }) => {
    const log = wf<{ input: string }>("logMachine")
      .subflow("machineLog", "machine.logValue", (ctx) => ({
        input: "ssss",
      }))
      .output((ctx) => ctx.results.machineLog);
    const getTerrain = wf("getTerrain")
      .subflow("getTerrain", "machine.getTerrain", (ctx) => ({}))

      .output((ctx) => ({ terrain: ctx.results.getTerrain, bonus: 24 }));

    return { getTerrain, log };
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

const helicopterMod = createModuleFactory<
  typeof helicopterReg,
  helicopterCtx
>()({
  use: { airplane: airplaneMod, baloon: baloonMod },
  define: ({ wf }) => {
    const getRoot = wf("getRoot")
      .subflow("getRoot", "airplane.log", (ctx) => ({ input: "xxx" }))
      .output((ctx) => "aaa");

    const testOwn = wf("testOwn").subflow("testOwn", "airplane.log", (ctx) => ({
      input: "xxx",
    }));
    const offGround = wf<{ cargo: string[] }>("offGround")
      .seq("loadCargo", "helicopter_loadCargo", (ctx) =>
        ctx.args(ctx.input.cargo, ctx.context.loadCapacity),
      )

      .seq("some", "machine_action_b1", (ctx) => ctx.args("vsp"))
      .seq("start", "helicopter_offGround")
      .subflow("sub", "airplane.getTerrain", (ctx) => ({}))
      .parallel(
        (b0) => b0.subflow("b0", "airplane.getTerrain", (ctx) => ({})),
        (b1) => b1.subflow("b1", "airplane.getTerrain", (ctx) => ({})),
        (b2) =>
          b2
            .seq("x", "machine_get_terrain", (ctx) => ctx.args(ctx.context))
            .seq("y", "machine_action_b2", (ctx) => {
              console.log("RESULTS at Y start", ctx.results);
              return ctx.args(ctx.results.sub.terrain);
            }),
      )
      .join("join", "machine_noop", (ctx) => {
        console.log(ctx.results);
        return ctx.none();
      })
      .output((ctx) => ({ x: ctx.results.b0, y: ctx.results.y, bonus: 22 }));
    return { offGround, getRoot };
  },
});

// const r0 = await airplaneRt.run(airplaneMod.deps.mahine.own.logValue, {
//   input: "something",
// });
eventStream.subscribe((ev) => {
  console.log("ui ev", ev);
});
// const r0 = await airplaneRt.run("machine.getTerrain", { input: "ccc" }, [
//   useLog(),
// ]);
// console.log(r0);
const helicopterRuntime = helicopterMod.createRuntime({
  registry: helicopterReg,
  context: {
    type: "helicopter",
    maxAltitude: 1200,
    terrain: airplaneRt.getContext().terrain,
    loadCapacity: 4,
  },
});

const h0 = await helicopterRuntime.run(
  "offGround",
  {
    cargo: ["box0", "box1", "box2", "box3"],
  },
  [useLog()],
);

console.log(h0.output.x.terrain);
//
// const h1 = helicopterRuntime.run("airplane.getTerrain", { input: "airplane" });
//
// const h2 = helicopterRuntime.run("airplane.log", { input: "xxx" });

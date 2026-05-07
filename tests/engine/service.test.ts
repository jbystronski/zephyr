// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import {
  createModuleFactory,
  createRuntimeRoot,
  FinalServices,
} from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";
import { exposeAll, exposeAllAs } from "../../src/utils";

type PayService = {
  stripe: {
    charge(amount: number): Promise<{ amount: number; paid: boolean }>;
  };
  actions: (typeof registryA)["actions"];
};

const createMod = createModuleFactory<PayService>();

const subchild = createMod({
  define: ({ wf }) => ({
    loc: wf("loc")
      .seq("a", "actions", "add", (ctx) => ctx.args(2, 2))
      .output((ctx) => ctx.get("a")),
  }),
});

const child = createMod({
  use: {},
  define: ({ wf }) => {
    const pay = wf<{ amount: number }>("payment")
      .init("pay_init")
      .seq("payment", "stripe", "charge", (ctx) =>
        ctx.args(ctx.get("pay_init").amount),
      )

      .output((ctx) => ctx.get("payment"));

    return { pay };
  },
});

const parent = createModuleFactory<PayService>()({
  use: {
    child,
    local: createMod({
      use: { child },
      define: ({ wf }) => ({
        st: wf("st")
          .seq("st", "stripe", "charge", (ctx) => ctx.args(333))
          .build(),
        localOne: wf<{ input: boolean }>("macro_1")
          .seq("add", "actions", "add", (ctx) => ctx.args(2, 3))
          .output((ctx) => ctx.get("add")),
        localTwo: wf("macro_2")
          .seq("add", "actions", "add", (ctx) => ctx.args(2, 3))
          .output((ctx) => ctx.get("add")),
      }),
    }),
  },
  expose: { macroOne: "local.localOne", ...exposeAllAs("child", child) },
  define: ({ wf }) => {
    const test = wf("test")
      .seq("sum_test", "actions", "add", (ctx) => ctx.args(2, 3))

      .subflow("macro", "local.localTwo", (ctx) => ({}))
      .subflow("result", "child.pay", (ctx) => ({
        amount: 400,
      }))

      .seq("sum_2_test", "actions", "add", (ctx) =>
        ctx.args(ctx.get("sum_test"), 10),
      )
      .output((ctx) => ctx.get("result"));

    return { test };
  },
});

describe("Service injection", () => {
  it("should execute service call from sub mod and return result", async () => {
    type Test = FinalServices<PayService, { child: typeof child }>;

    const root = await createRuntimeRoot({
      module: parent,
      services: {
        ...registryA,
        stripe: {
          async charge(amount: number) {
            console.log("charged ", amount);
            return { paid: true, amount };
          },
        },
      },
    });

    const r0 = await root.run("test", { amount: 3 });

    expect(r0.output).toEqual({ paid: true, amount: 400 });
  });
});

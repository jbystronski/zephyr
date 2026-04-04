// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { createModuleFactory } from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";
import { exposeAll, exposeAllAs } from "../../src/utils";

type PayService = {
  stripe: {
    charge(amount: number): Promise<{ amount: number; paid: boolean }>;
  };
};

const createMod = createModuleFactory<PayService>();

const child = createMod({
  actionRegistry: registryA,
  define: ({ wf }) => {
    const pay = wf<{ amount: number }>("payment")
      .service("payment", "stripe", "charge", (ctx) =>
        ctx.args(ctx.input.amount),
      )

      .output((ctx) => ctx.results.payment);

    return { pay };
  },
});

const parent = createMod({
  actionRegistry: registryA,
  use: {
    child,
    local: createMod({
      actionRegistry: registryA,
      use: { child },
      define: ({ wf }) => ({
        localOne: wf("macro_1")
          .seq("add", "add", (ctx) => ctx.args(2, 3))
          .output((ctx) => ctx.results.add),
        localTwo: wf("macro_2")
          .seq("add", "add", (ctx) => ctx.args(2, 3))
          .output((ctx) => ctx.results.add),
      }),
    }),
  },
  expose: { macroOne: "local.localOne", ...exposeAllAs("child", child) },
  define: ({ wf }) => {
    const test = wf("test")
      .seq("sum_test", "add", (ctx) => ctx.args(2, 3))

      .subflow("macro", "local.localTwo", (ctx) => ({}))
      .subflow("result", "child.pay", (ctx) => ({
        amount: 400,
      }))

      .seq("sum_2_test", "add", (ctx) => ctx.args(ctx.results.sum_test, 10))
      .output((ctx) => ctx.results.result);

    return { test };
  },
});

describe("Service injection", () => {
  it("should execute service call from sub mod and return result", async () => {
    const rt = parent.createRuntime({
      services: {
        stripe: {
          async charge(amount: number) {
            console.log("charged ", amount);
            return { paid: true, amount };
          },
        },
      },
    });

    const res = await rt.run("test", {}, [useLog()]);

    expect(res.output).toEqual({ paid: true, amount: 400 });
  });
});

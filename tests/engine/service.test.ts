// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { createModule } from "../../src/workflow-module";

import { createRuntime, StandardServices, useLog } from "../../src";
import { baseServices, createMeta } from "../../src/utils";
type PayService = {
  stripe: {
    charge(amount: number): Promise<{ amount: number; paid: boolean }>;
  };
};

const mod = createModule<StandardServices & { stripe: PayService["stripe"] }>();

const subchild = mod(({ wf }) => ({
  loc: wf("loc")
    .seq("a", (ctx) => ctx.math.add(2, 2))
    .output((ctx) => ctx.get("a")),
}));

const child = mod(({ wf }) => {
  const pay = wf<{ amount: number }>("payment")
    .init("pay_init")
    .seq("payment", (ctx) => ctx.stripe.charge(ctx.get("pay_init").amount))

    .output((ctx) => ctx.get("payment"));

  return { pay };
});

const local = mod(({ wf }) => ({
  st: wf("st")
    .seq("st", (ctx) => ctx.stripe.charge(333))
    .build(),
  localOne: wf<{ input: boolean }>("macro_1")
    .seq("add", (ctx) => ctx.math.add(2, 3))
    .output((ctx) => ctx.get("add")),
  localTwo: wf("macro_2")
    // .init("i")
    .seq("adding 2 and 3", (ctx) => ctx.math.add(2, 3))
    .output((ctx) => ctx.get("adding 2 and 3")),
}));

const parent = mod(({ wf }) => {
  const test = wf("test")
    .init("i")
    .sub("macro", local.localTwo, () => ({}))
    .sub("result", child.pay, () => ({
      amount: 400,
    }))

    .seq("sum_2_test", (ctx) => ctx.math.add(ctx.math.add(2, 3), 10))
    .output((ctx) => ctx.get("result"));

  return { test, macroOne: local.localOne };
});

const s = baseServices
  .add("stripe", {
    charge: async (amount: number) => ({ paid: true, amount }),
  })
  .build();

describe("Service injection", () => {
  it("should execute service call from sub mod and return result", async () => {
    const root = createRuntime(
      s,

      createMeta().service("stripe", { async: true }).build(),
    )
      .addMod("parent", parent)
      .build();

    const r0 = await root.run("parent", "test", { amount: 44 });

    expect(r0.output).toEqual({ paid: true, amount: 400 });
  });
});

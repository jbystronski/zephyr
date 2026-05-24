// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import {
  createModuleFactory,
  createRuntimeRoot,
} from "../../src/workflow-module";

import { StandardServices, useLog } from "../../src";
import { baseServices, createMeta } from "../../src/utils";
type PayService = {
  stripe: {
    charge(amount: number): Promise<{ amount: number; paid: boolean }>;
  };
};

const mod = createModuleFactory<
  StandardServices & { stripe: PayService["stripe"] }
>();

const subchild = mod({
  define: ({ wf }) => ({
    loc: wf("loc")
      .seq("a", (ctx) => ctx.math.add(2, 2))
      .output((ctx) => ctx.get("a")),
  }),
});

const child = mod({
  use: {},
  define: ({ wf }) => {
    const pay = wf<{ amount: number }>("payment")
      .init("pay_init")
      .seq("payment", (ctx) => ctx.stripe.charge(ctx.get("pay_init").amount))

      .output((ctx) => ctx.get("payment"));

    return { pay };
  },
});

const local = mod({
  use: { child },
  define: ({ wf }) => ({
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
  }),
});

const parent = mod({
  use: {
    child,
    local,
  },
  expose: { macroOne: local.localOne },
  define: ({ wf, deps: { child } }) => {
    const test = wf("test")
      .init("i")
      .subflow("macro", local.localTwo, () => ({}))
      .subflow("result", child.pay, () => ({
        amount: 400,
      }))

      .seq("sum_2_test", (ctx) => ctx.math.add(ctx.math.add(2, 3), 10))
      .output((ctx) => ctx.get("result"));

    return { test };
  },
});

const s = baseServices
  .add("stripe", {
    charge: async (amount: number) => ({ paid: true, amount }),
  })
  .build();

describe("Service injection", () => {
  it("should execute service call from sub mod and return result", async () => {
    const root = createRuntimeRoot({
      modules: { parent },
      services: s,

      meta: createMeta().service("stripe", { async: true }).build(),
    });

    const r0 = await root.run("parent", "test", { amount: 44 });

    expect(r0.output).toEqual({ paid: true, amount: 400 });
  });
});

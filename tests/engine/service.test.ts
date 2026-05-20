// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import {
  createModuleFactory,
  createRuntimeRoot,
  FinalServices,
} from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";
import { createMeta, exposeAll, exposeAllAs } from "../../src/utils";

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
      .seq("a", (ctx) => ctx.actions.add(2, 2))
      .output((ctx) => ctx.get("a")),
  }),
});

const child = createMod({
  use: {},
  define: ({ wf }) => {
    const pay = wf<{ amount: number }>("payment")
      .init("pay_init")
      .seq("payment", (ctx) => ctx.stripe.charge(ctx.get("pay_init").amount))

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
          .seq("st", (ctx) => ctx.stripe.charge(333))
          .build(),
        localOne: wf<{ input: boolean }>("macro_1")
          .seq("add", (ctx) => ctx.actions.add(2, 3))
          .output((ctx) => ctx.get("add")),
        localTwo: wf("macro_2")
          // .init("i")
          .seq("adding 2 and 3", (ctx) => ctx.actions.add(2, 3))
          .output((ctx) => ctx.get("adding 2 and 3")),
      }),
    }),
  },
  expose: { macroOne: "local.localOne", ...exposeAllAs("child", child) },
  define: ({ wf }) => {
    const test = wf("test")
      .init("i")
      .subflow("macro", "local.localTwo", (ctx) => ({}))
      .subflow("result", "child.pay", (ctx) => ({
        amount: 400,
      }))

      .seq("sum_2_test", (ctx) => ctx.actions.add(ctx.actions.add(2, 3), 10))
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
            return { paid: true, amount };
          },
        },
      },
      meta: createMeta().service("stripe", { async: true }).build(),
    });

    const r0 = await root.run("test", { amount: 44 }, []);

    expect(r0.output).toEqual({ paid: true, amount: 400 });
  });
});

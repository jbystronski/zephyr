// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import {
  createModuleFactory,
  createRuntimeRoot,
} from "../../src/workflow-module";

import { baseServices, createMeta, StandardServices, useLog } from "../../src";

type PayService = {
  stripe: {
    charge(amount: number): Promise<{ amount: number; paid: boolean }>;
  };
};

const mod = createModuleFactory<
  StandardServices & { stripe: PayService["stripe"] }
>();

const deepChildSecond = mod({
  define: ({ wf }) => ({
    deepChildActionSecond: wf<{ init: string }>("deepChildActionSecond")
      .init("init")
      .seq("actionSecond", (ctx) => ctx.string.upper(ctx.get("init").init))
      .output((ctx) => ({ deepRes: ctx.get("actionSecond") })),
  }),
});

const deepChild = mod({
  define: ({ wf }) => ({
    deepChildAction: wf<{ init: string }>("deepChildAction")
      .init("d2_init")
      .seq("action", (ctx) => ctx.string.upper(ctx.get("d2_init").init))
      .output((ctx) => ({ deepRes: ctx.get("action") })),
  }),
});

const child = mod({
  use: { deepChild, second: deepChildSecond },
  expose: { deepAction: deepChild.deepChildAction },
  define: ({ wf }) => ({
    sum: wf<{ a: number; b: number }>("sum")
      .init("d3_init")
      .seq("add", (ctx) =>
        ctx.math.add(ctx.get("d3_init").a, ctx.get("d3_init").b),
      )
      .seq("payment", (ctx) => ctx.stripe.charge(444))

      .output((ctx) => ctx.get("add")),
  }),
});

// type T = DepWorkflows<{ child: typeof child }>;

const parent = mod({
  use: { child },
  expose: { sub: child.sum },
  define: ({ wf, deps: { child } }) => {
    const test = wf("test")
      .subflow("deepAction", child.deepAction, () => ({ init: "abc" }))
      .sub("result", child.sum, () => ({ a: 2, b: 3 }))
      .output((ctx) => ctx.get("result"));

    return { test };
  },
});
const s = baseServices
  .add("stripe", {
    charge: async (amount: number) => ({ paid: true, amount }),
  })
  .build();

describe("Subflow", () => {
  it("should execute subflow and return result", async () => {
    const root = createRuntimeRoot({
      modules: { parent },
      services: s,
      meta: createMeta().service("stripe", { async: true }).build(),
    });

    const res = await root.run("parent", "test", {});

    // const childRes = childRt.run("sum")
    expect(res.output).toBe(5);
  });
});

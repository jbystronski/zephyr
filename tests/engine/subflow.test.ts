// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { createModule } from "../../src/workflow-module";

import {
  baseServices,
  createMeta,
  createRuntime,
  StandardServices,
  useLog,
} from "../../src";

type PayService = {
  stripe: {
    charge(amount: number): Promise<{ amount: number; paid: boolean }>;
  };
};

const mod = createModule<StandardServices & { stripe: PayService["stripe"] }>();

const deepChildSecond = mod(({ wf }) => ({
  deepChildActionSecond: wf<{ init: string }, any>("deepChildActionSecond")
    .init("init")
    .seq("actionSecond", (ctx) => ctx.string.upper(ctx.get("init").init))
    .output((ctx) => ({ deepRes: ctx.get("actionSecond") })),
}));

const deepChild = mod(({ wf }) => ({
  deepChildAction: wf<{ init: string }, any>("deepChildAction")
    .init("d2_init")
    .seq("action", (ctx) => ctx.string.upper(ctx.get("d2_init").init))
    .output((ctx) => ({ deepRes: ctx.get("action") })),
}));

const child = mod(({ wf }) => ({
  sum: wf<{ a: number; b: number }, any>("sum")
    .init("d3_init")
    .seq("add", (ctx) =>
      ctx.math.add(ctx.get("d3_init").a, ctx.get("d3_init").b),
    )
    .seq("payment", (ctx) => ctx.stripe.charge(444))

    .output((ctx) => ctx.get("add")),
  deepAction: deepChild.deepChildAction,
}));

// type T = DepWorkflows<{ child: typeof child }>;

const parent = mod(({ wf }) => {
  const test = wf<any, any>("test")
    .sub("deepAction", child.deepAction, () => ({ init: "abc" }))
    .sub("result", child.sum, () => ({ a: 2, b: 3 }))
    .output((ctx) => ctx.get("result"));

  return { test, sub: child.sum };
});

const s = baseServices
  .add("stripe", {
    charge: async (amount: number) => ({ paid: true, amount }),
  })
  .build();

describe("Subflow", () => {
  it("should execute subflow and return result", async () => {
    const root = createRuntime({
      services: s,
      meta: createMeta().service("stripe", { async: true }).build(),
    });

    const res = await root.run(parent.test, {});

    // const childRes = childRt.run("sum")
    expect(res.output).toBe(5);
  });
});

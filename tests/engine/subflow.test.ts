// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import {
  createModuleFactory,
  createRuntimeRoot,
} from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";

type PayService = {
  actions: (typeof registryA)["actions"];
  stripe: {
    charge(amount: number): Promise<number>;
  };
};

const createMod = createModuleFactory<PayService>();
const deepChildSecond = createMod({
  define: ({ wf }) => ({
    deepChildActionSecond: wf<{ init: string }>("deepChildActionSecond")
      .init("init")
      .seq("actionSecond", "actions", "uppercase", (ctx) =>
        ctx.args(ctx.get("init").init),
      )
      .output((ctx) => ({ deepRes: ctx.get("actionSecond") })),
  }),
});

const deepChild = createMod({
  define: ({ wf }) => ({
    deepChildAction: wf<{ init: string }>("deepChildAction")
      .init("d2_init")
      .seq("action", "actions", "uppercase", (ctx) =>
        ctx.args(ctx.get("d2_init").init),
      )
      .output((ctx) => ({ deepRes: ctx.get("action") })),
  }),
});

const child = createMod({
  use: { deepChild, second: deepChildSecond },
  expose: { deepAction: "deepChild.deepChildAction" },
  define: ({ wf }) => ({
    sum: wf<{ a: number; b: number }>("sum")
      .init("d3_init")
      .seq("add", "actions", "add", (ctx) =>
        ctx.args(ctx.get("d3_init").a, ctx.get("d3_init").b),
      )
      .seq("payment", "stripe", "charge", (ctx) => ctx.args(444))

      .output((ctx) => ctx.get("add")),
  }),
});

// type T = DepWorkflows<{ child: typeof child }>;

const parent = createMod({
  use: { child },
  expose: { sub: "child.sum" },
  define: ({ wf }) => {
    const test = wf("test")
      .subflow("deepAction", "child.deepAction", () => ({ init: "abc" }))
      .sub("result", "child.sum", () => ({ a: 2, b: 3 }))
      .output((ctx) => ctx.get("result"));

    return { test };
  },
});

describe("Subflow", () => {
  it("should execute subflow and return result", async () => {
    const root = createRuntimeRoot({
      module: parent,
      services: {
        ...registryA,
        stripe: {
          async charge(amount: number) {
            console.log("charged ", amount);
            return amount;
          },
        },
      },
    });

    const res = await root.run("test", {}, [useLog()]);

    // const childRes = childRt.run("sum")
    expect(res.output).toBe(5);
  });
});

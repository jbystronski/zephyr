// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { createModuleFactory } from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";

type PayService = {
  stripe: {
    charge(amount: number): Promise<number>;
  };
};

const createMod = createModuleFactory<PayService>();

const deepChild = createMod({
  actionRegistry: registryA,
  define: ({ wf }) => ({
    deepChildAction: wf<{ init: string }>("deepChildAction")
      .seq("action", "uppercase", (ctx) => ctx.args(ctx.input.init))
      .output((ctx) => ({ deepRes: ctx.results.action })),
  }),
});

const child = createMod({
  actionRegistry: registryA,
  use: { deepChild },
  expose: { deepAction: "deepChild.deepChildAction" },
  define: ({ wf }) => ({
    sum: wf<{ a: number; b: number }>("sum")
      .seq("add", "add", (ctx) => ctx.args(ctx.input.a, ctx.input.b))
      .service("payment", "stripe", "charge", (ctx) => ctx.args(444))

      .output((ctx) => ctx.add),
  }),
});

const parent = createMod({
  actionRegistry: registryA,
  use: { child },
  define: ({ wf }) => {
    const test = wf("test")
      .subflow("deepAction", "child.deepAction", () => ({ init: "abc" }))
      .sub("result", "child.sum", () => ({ a: 2, b: 3 }))
      .output((ctx) => ctx.result);

    return { test };
  },
});

describe("Subflow", () => {
  it("should execute subflow and return result", async () => {
    const rt = parent.createRuntime({
      services: {
        stripe: {
          async charge(amount: number) {
            console.log("charged ", amount);
            return amount;
          },
        },
      },
    });

    const res = await rt.run("test", {}, [useLog()]);

    const childRt = child.createRuntime({
      services: {
        ...rt.getServices(),
      },
    });

    // cost childRes = childRt.run("")
    expect(res.output).toBe(5);
  });
});

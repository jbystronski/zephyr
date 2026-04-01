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

const child = createMod({
  actionRegistry: registryA,
  define: ({ wf }) => {
    const sum = wf<{ a: number; b: number }>("sum")
      .seq("add", "add", (ctx) => ctx.args(ctx.input.a, ctx.input.b))
      .service("payment", "stripe", "charge", (ctx) => ctx.args(444))

      .output((ctx) => ctx.results.add);

    return { sum };
  },
});

const parent = createMod({
  actionRegistry: registryA,
  use: { child },
  define: ({ wf }) => {
    const test = wf("test")
      .subflow("result", "child.sum", () => ({ a: 2, b: 3 }))
      .output((ctx) => ctx.results.result);

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

    expect(res.output).toBe(5);
  });
});

// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { createModuleFactory } from "../../src/workflow-module";
import { registryA } from "../utils";
import { useLog } from "../../src";

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
  use: { child },
  define: ({ wf }) => {
    const test = wf("test")
      .subflow("result", "child.pay", () => ({ amount: 400 }))
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

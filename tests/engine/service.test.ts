// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { buildWF } from "../../src/";

import { createRuntime, StandardServices, useLog } from "../../src";
import { baseServices, createMeta } from "../../src/utils";
type PayService = {
  stripe: {
    charge(amount: number): Promise<{ amount: number; paid: boolean }>;
  };
};

const wf = buildWF<StandardServices & { stripe: PayService["stripe"] }>();

const loc = wf((_) => ({
  a: _.math.add(2, 2),
  out: _.steps.a,
}));

const pay = wf((_) => ({
  payment: _.stripe.charge(_.steps.i.amount),
  out: _.steps.payment,
}));

const st = wf((_) => ({
  st: _.stripe.charge(333),
}));

const localOne = wf((_) => ({
  add: _.math.add(2, 3),
  out: _.steps.add,
}));

const localTwo = wf((_) => ({
  add: _.math.add(2, 3),
  out: _.steps.add,
}));

const test = wf<{ i: { amount: number } }>((_) => ({
  macro: _.SUB(localTwo),
  result: _.SUB(pay, { amount: 400 }),
  sum: _.math.add(_.math.add(2, 3), 10),
  out: _.steps.result,
}));

const s = baseServices
  .add("stripe", {
    charge: async (amount: number) => ({ paid: true, amount }),
  })
  .build();

describe("Service injection", () => {
  it("should execute service call from sub mod and return result", async () => {
    const root = createRuntime({
      services: s,

      meta: createMeta().service("stripe", { async: true }).build(),
    });

    const r0 = await root.exec(test, { amount: 44 });

    expect(r0.output).toEqual({ paid: true, amount: 400 });
  });
});

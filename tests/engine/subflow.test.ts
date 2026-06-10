// /tests/modules/subflow.test.ts

import { describe, it, expect } from "vitest";
import { buildWF } from "../../src";

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

const wf = buildWF<StandardServices & { stripe: PayService["stripe"] }>();

const deepChildSecond = wf<{ i: { init: string }; out: { deepRes: string } }>(
  (_) => ({
    actionSecond: _.string.upper(_.steps.i.init),
    out: { deepRes: _.steps.actionSecond },
  }),
);

const deepChild = wf<{ out: { deepRes: string }; i: { init: string } }>(
  ({ steps: s, string }) => ({
    action: string.upper(s.i.init),
    out: { deepRes: s.action },
  }),
);

const sum = wf<{ i: { a: number; b: number }; out: number }>((_) => ({
  add: _.math.add(_.steps.i.a, _.steps.i.b),
  payment: _.stripe.charge(444),
  out: _.steps.add,
}));

const test = wf<{ out: number }>((_) => ({
  deepAction: _.SUB(deepChild, { init: "abc" }),
  result: _.SUB(sum, { a: 2, b: 3 }),
  out: _.steps.result,
}));

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

    const res = await root.exec(test);

    // const childRes = childRt.run("sum")
    expect(res.output).toBe(5);
  });
});

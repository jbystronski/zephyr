import { describe, it, expect } from "vitest";
import { createModule } from "../../src/workflow-module";

import {
  createRuntime,
  eventStream,
  type StandardServices,
  useLog,
} from "../../src";
import { baseServices, createMeta } from "../../src/utils";

eventStream.subscribe((ev: any) => {
  console.dir(ev, { depth: 12 });
});

const payService = {
  charge: async (amount: number) => ({ amount }),
  chargeSync: (amount: number) => ({ amount }),
};

const services = baseServices.add("pay", payService).build();

const meta = createMeta<typeof services>()
  .method("pay", "charge", {
    async: true,
  })
  .build();

const mod = createModule<StandardServices & { pay: typeof payService }>();

const A = mod(({ wf }) => ({
  pay: wf("pay")
    .seq("pay async direct", (_) => _.pay.charge(33))
    .seq("pay async nested", (_) => ({
      charged: _.pay.charge(44),
    }))
    .seq("pay sync", (_) => _.pay.chargeSync(22))
    .output((_) => ({
      a: _.get("pay async direct").amount,
      b: _.get("pay async nested").charged.amount,
      c: _.get("pay sync").amount,
      d: {
        charged: {
          nested: _.pay.charge(11),
        },
      },
    })),
}));

describe("Sync vs Async methods", () => {
  it("should correctly resolve sync call, async call (nested and direct)", async () => {
    const root = createRuntime(services, meta).addMod("A", A).build();

    const a = await root.run("A", "pay", {});

    expect(a.output).toEqual({
      a: 33,
      b: 44,
      c: 22,
      d: {
        charged: {
          nested: {
            amount: 11,
          },
        },
      },
    });
  });
});

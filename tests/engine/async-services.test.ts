import { describe, it, expect } from "vitest";

import {
  buildWF,
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

const wf = buildWF<StandardServices & { pay: typeof payService }>();

const pay = wf<{
  payAsyncDirect: { amount: number };
  paySync: { amount: number };
  payAsyncNested: any;
}>(
  ({
    steps: { payAsyncDirect, paySync, payAsyncNested },
    pay: { charge, chargeSync },
  }) => ({
    payAsyncDirect: charge(33),
    payAsyncNested: { charged: charge(44) },
    paySync: chargeSync(22),
    out: {
      a: payAsyncDirect.amount,
      b: payAsyncNested.charged.amount,
      c: paySync.amount,
      d: { charged: { nested: charge(11) } },
    },
  }),
);

describe("Sync vs Async methods", () => {
  it("should correctly resolve sync call, async call (nested and direct)", async () => {
    const root = createRuntime({ services, meta });

    const a = await root.exec(pay);

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

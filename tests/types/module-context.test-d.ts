// /tests/types/module-context.test-d.ts
import { expectType, expectError } from "tsd";
import { createActionRegistry, createModuleFactory } from "../../src";

// --------------------
// Action registries
// --------------------
const regA = createActionRegistry("a_")
  .action("add", (a: number, b: number) => a + b)
  .build();
const regB = createActionRegistry("b_")
  .action("divide", (a: number, b: number) => a / b)
  .build();

type ContextA = {
  maxConnections: number;
  dbConnection: { isConnected: () => boolean };
};
type ContextB = {
  paymentBroker: { pay: (amount: number) => Promise<boolean> };
};

// --------------------
// Modules
// --------------------
const modA = createModuleFactory<ContextA>()({
  actionRegistry: regA,
  define: ({ wf }) => ({}),
});

const modB = createModuleFactory<ContextB>()({
  use: { modA },
  actionRegistry: regB,
  define: ({ wf }) => ({}),
});

// --------------------
// Type-level tests
// --------------------
const runtime = modB.createRuntime({
  context: {
    // Must include:
    maxConnections: 10,
    dbConnection: { isConnected: () => true },
    paymentBroker: { pay: async (amount) => true },
  },
});

// ✅ Should type-check
expectType<number>(runtime.getContext().maxConnections);
expectType<() => boolean>(runtime.getContext().dbConnection.isConnected);
expectType<{ pay: (amount: number) => Promise<boolean> }>(
  runtime.getContext().paymentBroker,
);

// ❌ Should error if context is incomplete
expectError(
  modB.createRuntime({
    context: {
      // Missing dbConnection from modA
      maxConnections: 10,
      paymentBroker: { pay: async (amount) => true },
    },
  }),
);

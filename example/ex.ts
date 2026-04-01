import { createActionRegistry, createModuleFactory } from "../src";

const regA = createActionRegistry("a_")
  .action("add", (a: number, b: number) => a + b)
  .build();

const regB = createActionRegistry("b_")
  .action("divide", (a: number, b: number) => a / b)
  .build();

const regC = createActionRegistry("c_")
  .action("multiply", (a: number, b: number) => a * b)
  .build();

type RootCtx = {
  rootValue: boolean;
};

type ContextA = {
  maxConnections: number;
  dbConnection: { isConnected: () => boolean };
};

type ContextB = {
  paymentBroker: {
    pay: (amount: number, intentId: string) => Promise<boolean>;
  };
};

type ContextC = {
  initialValue: string;
};

const modRoot = createModuleFactory<RootCtx>()({
  actionRegistry: regA,
  define: ({}) => ({}),
});

type Services = {
  stripe: {
    charge: (amount: number) => Promise<number>;
    refund: (id: string) => Promise<boolean>;
  };
};

const modA = createModuleFactory<Services>()({
  use: { modRoot },
  actionRegistry: regA,
  define: ({ wf }) => ({
    add: wf<{ a: number; b: number }>("add")
      .seq("add", "a_add", (ctx) => ctx.args(ctx.input.a, ctx.input.b))
      .seq("add", "a_add", (ctx) => ctx.args(ctx.input.a, ctx.input.b))
      .output((ctx) => ({ addResult: ctx.results.add })),
  }),
});

const modB = createModuleFactory<ContextB>()({
  actionRegistry: regB,
  define: ({ wf }) => ({
    add: wf<{ a: number; b: number }>("divide")
      .seq("divide", "b_divide", (ctx) => ctx.args(ctx.input.a, ctx.input.b))
      .output((ctx) => ({ divideResult: ctx.results.divide })),
  }),
});

const modC = createModuleFactory<ContextC>()({
  use: { modA, modB },
  actionRegistry: regC,
  define: ({ wf }) => ({
    call_add: wf<{ numA: number; numB: number }>("call_add")
      .subflow("call_add", "modA.add", (ctx) => ({
        a: ctx.input.numA,
        b: ctx.input.numB,
      }))
      .output((ctx) => ctx.results.call_add),
  }),
});

const payu = {
  pay: async (amount: number, intentId: string) => {
    return true;
  },
};

const modCruntime = modC.createRuntime({
  context: {
    rootValue: false,
    initialValue: "foo",
    paymentBroker: payu,
    maxConnections: 3,
    dbConnection: { isConnected: () => true },
  },
});

const r0 = modCruntime.run("modA.add", { a: 1, b: 2 });

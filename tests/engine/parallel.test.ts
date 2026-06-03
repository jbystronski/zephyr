// /tests/engine/parallel.test.ts

import { describe, it, expect } from "vitest";

import { createModule, createRuntime } from "../../src";

const calls: string[] = [];

const local = {
  actions: {
    a: () => calls.push("A"),
    b: () => calls.push("B"),
    c: () => calls.push("C"),
    noop: () => {},
  },
};

describe("Parallel execution", () => {
  it("should execute all branches", async () => {
    calls.length = 0;

    const mod = createModule<typeof local>()(({ wf }) => ({
      test: wf<null, { a: any; b: any; c: any }>("parllel-test")
        .par(
          (b) => b.seq("a", (_) => _.actions.a()),
          (b) => b.seq("b", (_) => _.actions.b()),
          (b) => b.seq("c", (_) => _.actions.c()),
        )
        .join()
        .build(),
    }));

    const rt = createRuntime({ services: local });
    await rt.run(mod.test, null);

    expect(calls.sort()).toEqual(["A", "B", "C"]);
  });
});

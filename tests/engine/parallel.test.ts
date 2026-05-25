// /tests/engine/parallel.test.ts

import { describe, it, expect } from "vitest";

import { createModule, createRuntime, createRuntimeBuilder } from "../../src";

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
      test: wf("parllel-test")
        .par(
          (b) => b.seq("a", (_) => _.actions.a()),
          (b) => b.seq("b", (_) => _.actions.b()),
          (b) => b.seq("c", (_) => _.actions.c()),
        )
        .join()
        .build(),
    }));

    const rt = createRuntimeBuilder(local).addMod("mod", mod).build();
    await rt.run("mod", "test", {});

    expect(calls.sort()).toEqual(["A", "B", "C"]);
  });
});

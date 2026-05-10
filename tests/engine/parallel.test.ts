// /tests/engine/parallel.test.ts

import { describe, it, expect } from "vitest";

import { createModuleFactory, createRuntimeRoot } from "../../src";
import { registryA } from "../utils";

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

    const mod = createModuleFactory<typeof local>()({
      define: ({ wf }) => ({
        test: wf("parllel-test")
          .parallel(
            (b) => b.seq("a", (_) => _.actions.a()),
            (b) => b.seq("b", (_) => _.actions.b()),
            (b) => b.seq("c", (_) => _.actions.c()),
          )
          .join()
          .build(),
      }),
    });

    const rt = createRuntimeRoot({ module: mod, services: { ...local } });
    await rt.run("test", {});

    expect(calls.sort()).toEqual(["A", "B", "C"]);
  });
});

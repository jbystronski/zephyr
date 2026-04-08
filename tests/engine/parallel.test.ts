// /tests/engine/parallel.test.ts

import { describe, it, expect } from "vitest";
import { createWorkflow } from "../../src/workflow-composer";
import { runWorkflow } from "../utils";
import { useLog } from "../../src";

const calls: string[] = [];

const registry = {
  a: () => calls.push("A"),
  b: () => calls.push("B"),
  c: () => calls.push("C"),
  noop: () => {},
};

describe("Parallel execution", () => {
  it("should execute all branches", async () => {
    calls.length = 0;

    const wf = createWorkflow()("parallel-test")
      .parallel(
        (b) => b.seq("a", "a"),
        (b) => b.seq("b", "b"),
        (b) => b.seq("c", "c"),
      )
      .join("j");

    await runWorkflow({ workflow: wf, registry, observers: [] });

    expect(calls.sort()).toEqual(["A", "B", "C"]);
  });
});

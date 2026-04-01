import { describe, it, expect } from "vitest";
import { createWorkflow } from "../../src/workflow-composer";
import { runWorkflow, registryA } from "../utils";
import { useLog } from "../../src";

describe("Workflow engine - linear execution", () => {
  it("should execute steps in correct order", async () => {
    const wf = createWorkflow<typeof registryA, any, any>()<{ input: number }>(
      "linear-test",
    )
      .seq("step1", "add", (ctx) => ctx.args(ctx.input.input, 2))
      .seq("step2", "double", (ctx) => ctx.args(ctx.results.step1))
      .output((ctx) => ctx.results.step2);

    const { output } = await runWorkflow({
      workflow: wf,
      registry: registryA,
      input: { input: 3 },
      // observers: [useLog()],
    });

    expect(output).toBe(10);
  });
});

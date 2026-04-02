import { WorkflowObserver } from "../src";
import { eventStream } from "../src/event-stream";
import { useLog } from "../src/observer";
import { executeWorkflow } from "../src/workflow-executor";

eventStream.subscribe((ev: any) => {
  console.dir(ev, { depth: 3 });
});

export async function runWorkflow({
  workflow,
  registry,
  input = {},

  observers = [],
}: {
  workflow: any;
  registry: any;
  input?: any;
  context?: any;
  observers?: WorkflowObserver[];
}) {
  const result = await executeWorkflow({
    workflow,
    actionRegistry: registry,
    input,
    observers,
    services: {},
    depsExecutors: {},
  });

  return result;
}

export const registryA = {
  noop: () => {},
  add: (a: number, b: number) => a + b,
  sum: (input: { a: number; b: number }) => input.a + input.b,
  double: (n: number) => n * 2,
  addSuffix: (input: string, suffix: string) => input + suffix,
  addPrefix: (input: string, prefix: string) => prefix + input,
  uppercase: (input: string) => input.toUpperCase(),
};

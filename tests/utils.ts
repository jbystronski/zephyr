import { eventStream } from "../src/event-stream";

eventStream.subscribe((ev: any) => {
  console.dir(ev, { depth: 3 });
});

export const registryA = {
  actions: {
    noop: () => {},
    add: (a: number, b: number) => a + b,
    sum: (input: { a: number; b: number }) => input.a + input.b,
    double: (n: number) => n * 2,
    addSuffix: (input: string, suffix: string) => input + suffix,
    addPrefix: (input: string, prefix: string) => prefix + input,
    uppercase: (input: string) => input.toUpperCase(),
  },
};

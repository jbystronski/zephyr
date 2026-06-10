import { describe, it, expect } from "vitest";

import {
  baseServices,
  buildWF,
  createRuntime,
  eventStream,
  StandardServices,
  useLog,
  WorkflowOutput,
} from "../../src";

eventStream.subscribe((ev: any) => {
  console.dir(ev, { depth: 12 });
});

type ExplorerObject = {
  label: string;
  parent?: ExplorerObject;
  type: "root" | "leaf" | "branch";
  raw: {
    name: string;
    kind: string;
  };
};

const wf = buildWF<StandardServices>();

const accessChained = wf<{ i: { nestedObject: { foo: { bar: string } } } }>(
  (_) => ({
    extract: _.object.get(_.steps.i.nestedObject, "foo").bar,
    out: _.steps.extract,
  }),
);

const createExplorerObject = wf<{
  i: { key: string; parent?: ExplorerObject };
}>((_) => ({
  typeOfObject: _.std.if(_.steps.i.parent, "branch", "root"),
  created: {
    label: _.steps.i.key,
    parent: _.steps.i.parent,
    type: _.steps.typeOfObject,
    raw: {
      name: _.steps.i.key,
      kind: "bucket",
    },
  },
  out: _.steps.created,
}));

//TODO: error in this tests, some weird guard propagation issues
const findObject = wf<{ data: ExplorerObject[]; key: string }>((_) => ({
  noop: null,
  hasKey: _.IF(_.logic.truthy(_.steps.i.key), {
    findPipe: _.PIPE(
      "find",
      _.steps.i.data,
      { key: _.steps.i.key },
      wf<{ i: { item: any; key: string } }>((_) => ({
        out: _.logic.eq(_.steps.i.key, _.steps.i.item.label),
      })),
    ),
  }),
  out: { found: _.steps.findPipe },
}));

const createObjects = wf<{
  i: { initData: { label: string; kind: string }[] };
  out: { objects: any[] };
}>((_) => ({
  p1: _.PIPE(
    "map",
    _.steps.i.initData,
    {},
    wf<{ i: { item: any } }>((_) => ({
      obj: _.SUB(createExplorerObject, { key: _.steps.i.item.label }),
      out: _.steps.obj,
    })),
  ),
  out: { objects: _.steps.p1 },
}));

const createObjectsAndFind = wf<{
  i: { keyToFind: string; initData: { label: string; kind: string }[] };
  out: { found: any };
}>((_) => ({
  createdObject: _.SUB(createObjects, { initData: _.steps.i.initData }),
  find: _.SUB(findObject, {
    data: _.steps.createdObject.objects,
    key: _.steps.i.keyToFind,
  }),
  out: { found: _.steps.find.found },
}));

console.log("create objects and find wf");
console.dir(createObjectsAndFind, { depth: 16 });

const services = baseServices.build();

const rt = createRuntime({ services });

describe("Various tests", () => {
  it("should correctly return objects array created from piped subflow", async () => {
    const testOne = await rt.exec(createObjects, {
      initData: [
        { kind: "bucket", label: "emails" },
        { kind: "bucket", label: "configs" },
      ],
    });

    expect(testOne.output.objects).toEqual([
      {
        label: "emails",
        parent: undefined,
        type: "root",
        raw: {
          name: "emails",
          kind: "bucket",
        },
      },
      {
        label: "configs",
        parent: undefined,
        type: "root",
        raw: {
          name: "configs",
          kind: "bucket",
        },
      },
    ]);
  });

  it("should access AST value chained on call expression resolution", async () => {
    const testChained = await rt.exec(accessChained, {
      nestedObject: { foo: { bar: "BAZ" } },
    });

    expect(testChained.output).toBe("BAZ");
  });

  it("should correctly return find explorer object if key exists", async () => {
    const testTwo = await rt.exec(createObjectsAndFind, {
      initData: [
        { kind: "bucket", label: "emails" },
        { kind: "bucket", label: "configs" },
      ],
      keyToFind: "emails",
    });

    expect(testTwo.output.found).toEqual({
      label: "emails",
      parent: undefined,
      type: "root",
      raw: {
        name: "emails",
        kind: "bucket",
      },
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  createModuleFactory,
  createRuntimeRoot,
} from "../../src/workflow-module";
import { registryA } from "../utils";
import { baseServices, StandardServices, useLog } from "../../src";

type ExplorerObject = {
  label: string;
  parent?: ExplorerObject;
  type: "root" | "leaf" | "branch";
  raw: {
    name: string;
    kind: string;
  };
};

const mod = createModuleFactory<StandardServices>();

const modB = mod({
  define: ({ wf }) => ({
    createExplorerObject: wf<{ key: string; parent?: ExplorerObject }>(
      "create explorer object",
    )
      .init("i")
      .seq("type of object", "std", "if", ({ args, get }) =>
        args(get("i").parent, "branch", "root"),
      )
      .seq("created", "std", "const", ({ args, get }) =>
        args({
          label: get("i").key,
          parent: get("i").parent,
          type: get("type of object"),
          raw: {
            name: get("i").key,
            kind: "bucket",
          },
        }),
      )
      .as<ExplorerObject>()
      .output(({ get }) => get("created")),

    findObject: wf<{ data: ExplorerObject[]; key: string }>("find obejct")
      .init("i")
      .if(
        "has key",
        ({ truthy, get }) => truthy(get("i").key),
        (b) =>
          b.pipe(
            "find pipe",
            "find",
            ({ get }) => get("i").data,
            (b) =>
              b
                .init("item")
                .eval("match label", ({ get, eq }) =>
                  eq(get("i").key, get("item").label),
                ),
          ),
      )
      .output(({ get }) => ({ found: get("find pipe") })),
  }),
});

const modA = mod({
  use: { modB },
  expose: { findObject: "modB.findObject" },
  define: ({ wf }) => ({
    createObjects: wf<{ initData: { label: string; kind: string }[] }>(
      "create objects",
    )
      .init("i")
      .pipe(
        "p 1",
        "map",
        ({ get }) => get("i").initData,
        (b) =>
          b
            .init("item")
            .sub("new object", "modB.createExplorerObject", ({ get }) => ({
              key: get("item").label,
            })),
      )
      .as<ExplorerObject[]>()
      .output(({ get }) => ({
        objects: get("p 1"),
      })),
  }),
});

const modC = mod({
  use: { modA },
  define: ({ wf }) => ({
    createObjectsAndFind: wf<{
      keyToFind: string;
      initData: { label: string; kind: string }[];
    }>("create object and find by key")
      .init("i")
      .sub("created objects", "modA.createObjects", ({ get }) => ({
        initData: get("i").initData,
      }))

      .sub("find", "modA.findObject", ({ get }) => ({
        data: get("created objects").objects,
        key: get("i").keyToFind,
      }))
      .output(({ get }) => ({ found: get("find").found })),
  }),
});

const services = baseServices.build();

const modAruntime = createRuntimeRoot({
  module: modA,
  services,
});

const modCruntime = createRuntimeRoot({
  module: modC,
  services,
});

describe("Various tests", () => {
  it("should correctly return objects array created from piped subflow", async () => {
    const testOne = await modAruntime.run("createObjects", {
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

  it("should correctly return find explorer object if key exists", async () => {
    const testTwo = await modCruntime.run(
      "createObjectsAndFind",
      {
        initData: [
          { kind: "bucket", label: "emails" },
          { kind: "bucket", label: "configs" },
        ],
        keyToFind: "emails",
      },
      [useLog()],
    );

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

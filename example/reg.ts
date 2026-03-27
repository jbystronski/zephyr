import {
  fixedAction,
  createWorkflow,
  createActionRegistry,
} from "../src/index.js";

const log = fixedAction(async (input: { toLog: any }) => {
  console.log(input.toLog);
});

const multiply = fixedAction(async (input: { base: number; m: number }) => {
  return input.base * input.m;
});

export const uppercase = async (input: { text: string }) => {
  return input.text.toUpperCase();
};

const exclaim = async (input: { text: string }) => {
  return input.text + "!!!";
};

const repeat = (input: { text: string; times: number }) => {
  return input.text.repeat(input.times);
};

const lc = async (input: { someText: string }) => {
  return input.someText.toLowerCase();
};

const baseActions = createActionRegistry().action("logger", log());

const numericActions = createActionRegistry().action("multiply", multiply());
const toUppercase = async (input: { text: string }) => input.text.toUpperCase();

export const opsRegistry = createActionRegistry()
  .extend(baseActions)
  .extend(numericActions)
  .action("uppercase", uppercase)
  .action("exclaim", exclaim)
  .action("repeat", repeat)
  .action("toUpNode", toUppercase)
  .build();

opsRegistry.multiply({ m: 4, base: 10 });
opsRegistry.logger({ toLog: "VALUE" });

export const subReg = createActionRegistry()
  .action("toUp", uppercase)
  .action("lowercase", lc)
  .build();

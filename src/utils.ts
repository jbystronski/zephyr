import { Module } from "./workflow-module.js";

export function generateWorkflowId(name: string) {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${name}-${time}-${random}`;
}

export function exposeAll<
  Name extends string,
  M extends Module<any, any, any, any, any>,
>(name: Name, mod: M) {
  type Keys = keyof M["workflows"] & string;

  const result = {} as Record<`${Name}.${Keys}`, `${Name}.${Keys}`>;

  for (const key in mod.workflows) {
    const full = `${name}.${key}` as `${Name}.${Keys}`;
    result[full] = full;
  }

  return result;
}

export function exposeAllAs<
  Name extends string,
  M extends Module<any, any, any, any, any>,
>(name: Name, mod: M) {
  type Keys = keyof M["workflows"] & string;

  const result = {} as Record<Keys, `${Name}.${Keys}`>;

  for (const key in mod.workflows) {
    result[key as Keys] = `${name}.${key}` as `${Name}.${Keys}`;
  }

  return result;
}

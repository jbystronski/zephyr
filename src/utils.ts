import {
  arrayLib,
  dateLib,
  errLib,
  extendedJsonLib,
  logicLib,
  mathLib,
  miscLib,
  objectLib,
  stdLib,
  stringLib,
} from "./services.js";
import { Module } from "./workflow-module.js";
let idCounter = 0;

export function generateWorkflowId(name: string) {
  const id = (idCounter++).toString(36);
  return name ? `${name}-${id}` : id;
}
// export function generateWorkflowId(name: string) {
//   const random = Math.random().toString(36).slice(2, 12);
//
//   return name ? `${name}-${random}` : random;
// }

export function exposeAll<
  Name extends string,
  M extends Module<any, any, any, any>,
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
  M extends Module<any, any, any, any>,
>(name: Name, mod: M) {
  type Keys = keyof M["workflows"] & string;

  const result = {} as Record<Keys, `${Name}.${Keys}`>;

  for (const key in mod.workflows) {
    result[key as Keys] = `${name}.${key}` as `${Name}.${Keys}`;
  }

  return result;
}

export function createAliasResolver(results: any, aliasMap: any) {
  return (id: string) => {
    const uid = aliasMap.results[id];
    return uid ? results[uid] : undefined;
  };
}

export type ServiceMap = Record<string, any>;

export class ServiceBuilder<S extends ServiceMap> {
  constructor(private services: S) {}

  add<K extends string, T>(
    key: K extends keyof S ? never : K,
    service: T,
  ): ServiceBuilder<S & { [P in K]: T }> {
    return new ServiceBuilder({
      ...this.services,
      [key]: service,
    } as S & { [P in K]: T });
  }

  build(): S {
    return this.services;
  }
}

export function createServices() {
  return new ServiceBuilder({});
}

export const baseServices = createServices()
  .add("date", dateLib)
  .add("std", stdLib)
  .add("string", stringLib)
  .add("math", mathLib)
  .add("array", arrayLib)
  .add("object", objectLib)
  .add("logic", logicLib)
  .add("misc", miscLib)
  .add("extended_json", extendedJsonLib)
  .add("err", errLib);

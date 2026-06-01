import { arrayLib } from "./services/array.js";
import { stdLib } from "./services/base.js";
import { dateLib } from "./services/date.js";
import { errLib } from "./services/error.js";
import { extendedJsonLib } from "./services/extended-json.js";
import { logicLib } from "./services/logic.js";
import { mathLib } from "./services/math.js";
import { miscLib } from "./services/misc.js";
import { objectLib } from "./services/object.js";
import { stringLib } from "./services/string.js";
import { ServiceMeta, ServiceMetaRegistry, ServiceMetaRule } from "./types.js";

let idCounter = 0;

export function generateWorkflowId(name: string) {
  const id = (idCounter++).toString(36);
  return name ? `${name}-${id}` : id;
}

export const uniqueId = () => generateWorkflowId("");
// export function generateWorkflowId(name: string) {
//   const random = Math.random().toString(36).slice(2, 12);
//
//   return name ? `${name}-${random}` : random;
// }

export function createAliasResolver(results: any, aliasMap: any) {
  return (id: string) => {
    const uid = aliasMap.results[id];
    return uid ? results[uid] : undefined;
  };
}

// export type ServiceMap = Record<string, any>;
export interface ServiceMap {}
export class ServiceBuilder<S extends ServiceMap = {}> {
  constructor(private services: S) {}

  add<K extends string, T>(
    key: K extends keyof S ? never : K,
    service: T,
    options?: { meta?: Record<string, boolean> },
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

export class ServiceMetaBuilder<
  S extends Record<string, any> = any,
  M extends ServiceMetaRegistry<S> = ServiceMetaRegistry<S>,
> {
  constructor(private meta: M = {} as M) {}

  service<K extends keyof S>(service: K, rule: ServiceMetaRule) {
    return new ServiceMetaBuilder<S, M>({
      ...this.meta,
      [service]: {
        ...(this.meta[service] ?? {}),
        service: rule,
      },
    } as M);
  }

  method<K extends keyof S>(
    service: K,
    method: keyof S[K] & string,
    rule: ServiceMeta,
  ) {
    return new ServiceMetaBuilder<S, M>({
      ...this.meta,
      [service]: {
        ...(this.meta[service] ?? {}),
        methods: {
          ...(this.meta[service]?.methods ?? {}),
          [method]: rule,
        },
      },
    } as M);
  }

  pattern<K extends keyof S>(service: K, match: RegExp, rule: ServiceMeta) {
    return new ServiceMetaBuilder<S, M>({
      ...this.meta,
      [service]: {
        ...(this.meta[service] ?? {}),
        patterns: [
          ...(this.meta[service]?.patterns ?? []),
          { match, meta: rule },
        ],
      },
    } as M);
  }

  build() {
    return this.meta;
  }
}

export function createMeta<S extends Record<string, any> = any>() {
  return new ServiceMetaBuilder<S>();
}

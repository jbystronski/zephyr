import { ActionRegistry, MergeActionRegistries } from "./types.js";

export class ActionRegistryBuilder<
  R extends ActionRegistry = {},
  Prefix extends string = "",
> {
  private registry: Partial<R> = {};

  constructor(
    private prefix: Prefix,
    initial?: R,
  ) {
    if (initial) {
      this.registry = { ...initial };
    }
  }

  /**
   * Accepts ANY function - sync or async, any parameter shape
   * F captures the complete function signature for full type inference
   */
  action<K extends string, F extends (...args: any[]) => any>(
    key: K,
    action: F, // 👈 F is the actual function type
  ): ActionRegistryBuilder<
    MergeActionRegistries<R, Record<`${Prefix}${K}`, F>>,
    Prefix
  > {
    const fullKey = `${this.prefix}${key}`;

    if (fullKey in this.registry) {
      throw new Error(`Action "${fullKey}" already exists`);
    }

    (this.registry as any)[fullKey] = action;
    return this as any;
  }

  // Extend with another registry (with override)
  extend<Other extends ActionRegistry>(
    other: ActionRegistryBuilder<Other, any> | Other,
  ): ActionRegistryBuilder<MergeActionRegistries<R, Other>, Prefix> {
    const otherRegistry =
      other instanceof ActionRegistryBuilder ? other.build() : other;

    for (const key in otherRegistry) {
      if (key in this.registry) {
        throw new Error(`Action collision detected "${key}"`);
      }
    }

    Object.assign(this.registry, otherRegistry);
    return this as any;
  }

  build(): R {
    return this.registry as R;
  }
}

export function createActionRegistry<
  R extends ActionRegistry = {},
  Prefix extends string = "",
>(prefix: Prefix, initial?: R): ActionRegistryBuilder<R, Prefix> {
  if (!prefix || typeof prefix !== "string" || prefix?.trim() === "") {
    throw new Error(`Registry prefix is required`);
  }

  return new ActionRegistryBuilder(prefix, initial);
}

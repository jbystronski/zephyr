import { ActionRegistry, MergeActionRegistries } from "./types.js";

export class ActionRegistryBuilder<R extends ActionRegistry = {}> {
  private registry: Partial<R> = {};

  constructor(initial?: R) {
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
  ): ActionRegistryBuilder<MergeActionRegistries<R, Record<K, F>>> {
    (this.registry as any)[key] = action;
    return this as any;
  }

  // Extend with another registry (with override)
  extend<Other extends ActionRegistry>(
    other: ActionRegistryBuilder<Other> | Other,
  ): ActionRegistryBuilder<MergeActionRegistries<R, Other>> {
    const otherRegistry =
      other instanceof ActionRegistryBuilder ? other.build() : other;

    Object.assign(this.registry, otherRegistry);
    return this as any;
  }

  build(): R {
    return this.registry as R;
  }
}

export function createActionRegistry<R extends ActionRegistry = {}>(
  initial?: R,
): ActionRegistryBuilder<R> {
  return new ActionRegistryBuilder(initial);
}

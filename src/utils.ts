// Just type helpers - no runtime wrappers needed
type AnyFn = (...args: any[]) => any;
type Input<F extends AnyFn> = Parameters<F>[0];
type Output<F extends AnyFn> = Awaited<ReturnType<F>>;

/**
 * For generic actions - preserves the generic parameter
 */
export function genericAction<F extends AnyFn>(fn: F) {
  // Return a function that takes a type parameter and returns the typed function
  return <T>(): ((...args: Parameters<F>) => ReturnType<F>) => {
    return fn as (...args: Parameters<F>) => ReturnType<F>;
  };
}

/**
 * For fixed actions
 */
export function fixedAction<F extends AnyFn>(fn: F) {
  return (): ((...args: Parameters<F>) => ReturnType<F>) => {
    return fn as (...args: Parameters<F>) => ReturnType<F>;
  };
}

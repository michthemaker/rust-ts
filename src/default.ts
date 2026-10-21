import { trait } from "./trait";

/**
 * @remarks Implement the static `default` method on the class implementing this trait
 *
 * ```typescript
 * class OnceLock extends impl(Default) {
 *  static default<T>(): T {...}
 * }
 * ```
 */
export const Default = trait((b) => {
  // @ts-ignore
  abstract class Default<T> extends b {
    static default<T>(): Default<T> {
      throw new Error("static default method not implemented");
    }
  }
  return Default;
});

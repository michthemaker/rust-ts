import { is_sub_class_of } from "../lib/is_sub_class";
import { LooseInstanceType, Trait as TTrait, trait } from "./trait";

const __first_half = (() => {
  // @ts-expect-error
  abstract class Default<T> {
    static default<T>(): Default<T> {
      throw new Error(
        `required static default method not implemented on ${this.name} that implements Default trait`,
      );
    }
    // @ts-expect-error
    protected constructor(...args: any[]) {}
  }
  return Default;
})();

/**
 * @remarks Implement the static `default` method on the class implementing this trait
 *
 * if not implementes in the class, any call to it throws
 *
 * @example
 * ```ts
 * class OnceLock extends impl(Default) {
 *  static default<T>(): { return new OnceLock<T>; }
 * }
 * ```
 */
export const Default = (() => {
  const Default = __first_half;

  interface Trait<T extends typeof Default> extends TTrait<T> {
    default<T extends typeof Default>(type: T): LooseInstanceType<T>;
  }

  const __Default = Object.assign(
    trait(() => Default),
    {
      default<T extends typeof Default>(type: T) {
        if (is_sub_class_of(type, Default)) return type.default() as LooseInstanceType<T>;
        else throw new Error(`the trait bound ${type.name}: Default is not satisfied`);
      },
    },
  ) as unknown as Trait<typeof Default>;
  return __Default;
})();

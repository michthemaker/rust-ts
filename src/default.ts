import { impls, trait } from "./trait.ts";
import type { Trait as TTrait, LooseInstanceType } from "./trait.ts";

const __first_half = (() => {
	return trait((b: any) => {
		// @ts-ignore
		// oxlint-disable-next-line no-unused-vars
		abstract class Default<T> extends b {
			static default<T>(): Default<T> {
				throw new Error(
					`required static default method not implemented on ${this.name} that implements Default trait`
				);
			}
			// @ts-ignore
			// oxlint-disable-next-line no-unused-vars
			protected constructor(...args: any[]) {
				super();
			}
		}
		return Default;
	});
})();

export type DefaultType = ReturnType<(typeof __first_half)["factory"]>;

export interface DefaultCall {
	default<T extends DefaultType>(type: T): LooseInstanceType<T>;
}

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
	const Default = __first_half.factory(class {});

	interface Trait<T extends typeof Default> extends TTrait<T>, DefaultCall {}

	const __Default = Object.assign(__first_half, {
		default<T extends typeof Default>(type: T) {
			// this will always fail, this
			if (impls(type, __first_half)) return type.default();
			else throw new Error(`the trait bound ${(type as any).name}: Default is not satisfied`);
		}
	}) as unknown as Trait<typeof Default>;
	return __Default;
})();

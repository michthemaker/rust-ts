import { Option } from "./option.ts";
import { define_pattern, Pattern, type Pat } from "./match_impl.ts";
import { is_eq } from "./cmp.ts";
import { Vec as Impl } from "./vec_impl.ts";
import type { TraitInstance } from "./trait_impl.ts";
import type { AsyncDrop, Drop } from "./ops.ts";

class Vec<T> extends Impl<T> {
	constructor() {
		// @ts-expect-error
		super(...arguments);
	}
}

interface Vec<T> extends Impl<T> {}

declare module "./default.ts" {
	interface DefaultCall {
		default<T extends typeof Vec<any>>(type: T): T extends typeof Vec<infer U> ? Vec<U> : never;
	}
}

/**
 * Creates a Vector of elements that extends Iterable type, AsyncDrop and Drop traits
 * @description `vec![]`
 */
function vec<
	T extends TraitInstance<typeof AsyncDrop> & TraitInstance<typeof Drop> & Iterable<any, any, any>
>(): Vec<T>;
/**
 * Creates a Vector of items that implement AsyncDrop trait
 * @description `vec![]`
 */
function vec<T extends TraitInstance<typeof AsyncDrop>>(): Vec<T>;
/**
 * Creates a Vector of items that implement Drop trait
 * @description `vec![]`
 */
function vec<T extends TraitInstance<typeof Drop>>(): Vec<T>;
/**
 * Do not mix types in vectors
 */
function vec<T extends TraitInstance<typeof Drop | typeof AsyncDrop>>(): [T] extends [
	TraitInstance<typeof Drop | typeof AsyncDrop>
]
	? never
	: Vec<T>;
/** @description `vec![]` */
function vec<T extends unknown>(): Vec<T>;
// vec![0, 0, 0]
/**
 * Creates a Vector of elements that extends Iterable type, AsyncDrop and Drop traits
 * @description `vec![0, 0, 0]`
 */
function vec<
	T extends TraitInstance<typeof AsyncDrop> & TraitInstance<typeof Drop> & Iterable<any, any, any>
>(array: Array<T>): Vec<T>;
/**
 * Creates a Vector of items that implement AsyncDrop trait
 * @description `vec![0, 0, 0]`
 */
function vec<T extends TraitInstance<typeof AsyncDrop>>(array: Array<T>): Vec<T>;
/**
 * Creates a Vector of items that implement Drop trait
 * @description `vec![0, 0, 0]`
 */
function vec<T extends TraitInstance<typeof Drop>>(array: Array<T>): Vec<T>;
/**
 * Do not mix types in vectors
 */
function vec<T extends TraitInstance<typeof Drop | typeof AsyncDrop>>(array: Array<T>): never;
/**
 * @description `vec![0, 0, 0]`
 */
function vec<T extends unknown>(array: Array<T>): Vec<T>;
// vec![elem; n]
/**
 * Creates a Vector of elements that extends Iterable type, AsyncDrop and Drop traits
 * @description `vec![elem; n]`: n elements, each a clone of `value` (the last one is `value` itself).
 */
function vec<
	T extends TraitInstance<typeof AsyncDrop> & TraitInstance<typeof Drop> & Iterable<any, any, any>
>(elem: T, n: number): Vec<T>;
/**
 * Creates a Vector of items that implement AsyncDrop trait
 * @description `vec![elem; n]`: n elements, each a clone of `value` (the last one is `value` itself).
 */
function vec<T extends TraitInstance<typeof AsyncDrop>>(elem: T, n: number): Vec<T>;
/**
 * Creates a Vector of items that implement Drop trait
 * @description `vec![elem; n]`: n elements, each a clone of `value` (the last one is `value` itself).
 */
function vec<T extends TraitInstance<typeof Drop>>(elem: T, n: number): Vec<T>;
/**
 * Do not mix types in vectors
 */
function vec<T extends TraitInstance<typeof Drop | typeof AsyncDrop>>(elem: T, n: number): never;
/** @description `vec![elem; n]`: n elements, each a clone of `value` (the last one is `value` itself). */
function vec<T extends unknown>(elem: T, n: number): Vec<T>;

function vec(arg1?: any, arg2?: any) {
	if (arg2) {
		if (!Number.isInteger(arg2))
			throw new Error(`vec(elem, n): n must be a non-negative integer, got ${arg2}`);
		// @ts-ignore
		return Vec.from_elem(arg1, arg2);
	} else if (arg1)
		// @ts-ignore
		return Vec.from_iter(arg1);
	// @ts-ignore
	else return Vec.from_iter([]);
}

declare module "./match_impl.ts" {
	interface PatternKinds<T> {
		"rust-ts::std::Vec<T>": T extends Vec<infer X> ? [X[]] : never;
	}
	interface PatternInterface {
		Vec<T>(expected: T[]): Pat<"rust-ts::std::Vec<T>">;
	}
}

Pattern.Vec = function (expected) {
	return define_pattern("rust-ts::std::Vec<T>", (subject: any) => {
		if (subject && subject instanceof Impl) {
			const current = subject.to_array();
			if (is_eq(current, expected)) return Option.Some([current]);
		}
		return Option.None();
	});
};

export { Vec, vec };

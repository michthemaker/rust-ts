import { is_eq } from "./cmp.ts";
import { define_pattern, Pattern, type Pat } from "./match_impl.ts";
import { Option } from "./option.ts";
import { FixedArray as Impl } from "./array_impl.ts";
import type { TraitInstance } from "./trait_impl.ts";
import type { AsyncDrop, Drop } from "./ops.ts";

type TupleToIndices<Tuple extends any[]> = {
	[Index in Extract<keyof Tuple, `${number}`>]: Tuple[Index];
};

type FixedIndices<T, N extends number, R extends T[] = []> = R["length"] extends N
	? R
	: FixedIndices<T, N, [T, ...R]>;

type FixedArray<T, N extends number> = TupleToIndices<FixedIndices<T, N>> & Impl<T, N>;

interface FixedArrayConstructor {
	// new call
	/**
	 * Creates a fixed array of items that implement AsyncDrop trait
	 */
	new <T extends TraitInstance<typeof AsyncDrop>, N extends number>(
		initial_value: T,
		size: N
	): FixedArray<T, N>;
	/**
	 * Creates a fixed array of items that implement Drop trait
	 */
	new <T extends TraitInstance<typeof Drop>, N extends number>(
		initial_value: T,
		size: N
	): FixedArray<T, N>;
	/**
	 * Creates a fixed array
	 */
	new <T extends unknown, N extends number>(initial_value: T, size: N): FixedArray<T, N>;
	// function call
	/**
	 * Creates a fixed array of items that implement AsyncDrop trait
	 */
	<T extends TraitInstance<typeof AsyncDrop>, N extends number>(
		initial_value: T,
		size: N
	): FixedArray<T, N>;
	/**
	 * Creates a fixed array of items that implement Drop trait
	 */
	<T extends TraitInstance<typeof Drop>, N extends number>(
		initial_value: T,
		size: N
	): FixedArray<T, N>;
	/**
	 * Creates a fixed array
	 */
	<T extends unknown, N extends number>(initial_value: T, size: N): FixedArray<T, N>;
	/**
	 * Creates a fixed array of elements that extends Iterable and AsyncDrop and Drop traits
	 */
	from_fn<
		T extends TraitInstance<typeof AsyncDrop> &
			TraitInstance<typeof Drop> &
			Iterable<any, any, any>,
		N extends number
	>(
		N: N,
		f: (index: number) => T
	): FixedArray<T, N>;
	/**
	 * Creates a fixed array of items that implement AsyncDrop trait
	 */
	from_fn<T extends TraitInstance<typeof AsyncDrop>, N extends number>(
		N: N,
		f: (index: number) => T
	): FixedArray<T, N>;
	/**
	 * Creates a fixed array of items that implement Drop trait
	 */
	from_fn<T extends TraitInstance<typeof Drop>, N extends number>(
		N: N,
		f: (index: number) => T
	): FixedArray<T, N>;
	/**
	 * Do not mix types in arrays
	 */
	from_fn<T extends TraitInstance<typeof AsyncDrop | typeof Drop>, N extends number>(
		N: N,
		f: (index: number) => T
	): never;
	/**
	 * Creates a fixed array
	 */
	from_fn<T extends unknown, N extends number>(N: N, f: (index: number) => T): FixedArray<T, N>;
}

function FixedArrayImpl(this: any, initial_value: any, size: number) {
	// Allow both `FixedArray(...)` and `new FixedArray(...)`
	if (!(this instanceof FixedArrayImpl)) {
		return new (FixedArrayImpl as any)(initial_value, size);
	}

	// Delegate to the real class constructor (which returns a Proxy)
	return new Impl(initial_value, size);
}

// Copy statics from the real class
FixedArrayImpl.from_fn = Impl.from_fn.bind(Impl);

// Make `instanceof FixedArray` work
Object.defineProperty(FixedArrayImpl, Symbol.hasInstance, {
	value(instance: any) {
		return instance instanceof Impl;
	}
});

// Prototype chain so methods are found when people look at the constructor
FixedArrayImpl.prototype = Impl.prototype;

const FixedArray = FixedArrayImpl as unknown as FixedArrayConstructor;

declare module "./match_impl.ts" {
	interface PatternKinds<T> {
		"rust-ts::std::FixedArray<T, N>": [T];
	}
	interface PatternInterface {
		FixedArray<T>(expected: T[]): Pat<"rust-ts::std::FixedArray<T, N>">;
	}
}

Pattern.FixedArray = function (expected) {
	return define_pattern("rust-ts::std::FixedArray<T, N>", (subject: any) => {
		if (subject && subject instanceof Impl) {
			const current = subject.to_array();
			if (is_eq(current, expected)) return Option.Some([subject]);
		}
		return Option.None();
	});
};

export { FixedArray };

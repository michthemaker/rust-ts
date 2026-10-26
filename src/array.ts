import { is_eq } from "./cmp.ts";
import { define_pattern, Pattern, type Pat } from "./match_impl.ts";
import { Option } from "./option.ts";
import { FixedArray as Impl } from "./array_impl.ts";

type TupleToIndices<Tuple extends any[]> = {
	[Index in Extract<keyof Tuple, `${number}`>]: Tuple[Index];
};

type FixedIndices<T, N extends number, R extends T[] = []> = R["length"] extends N
	? R
	: FixedIndices<T, N, [T, ...R]>;

type FixedArray<T, N extends number> = TupleToIndices<FixedIndices<T, N>> & Impl<T, N>;

interface FixedArrayConstructor {
	new <T, N extends number>(initial_value: T, size: N): FixedArray<T, N>;
	<T, N extends number>(initial_value: T, size: N): FixedArray<T, N>;
	from_fn<T, N extends number>(N: N, f: (index: number) => T): FixedArray<T, N>;
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

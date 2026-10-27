import { Option } from "./option.ts";
import { define_pattern, Pattern, type Pat } from "./match_impl.ts";
import { is_eq } from "./cmp.ts";
import { Vec as Impl } from "./vec_impl.ts";

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

/** `vec![]` */
function vec<T>(): Vec<T>;
/** `vec![0, 0, 0]` */
function vec<T>(array: Array<T>): Vec<T>;
/** `vec![elem; n]`: n elements, each a clone of `value` (the last one is `value` itself). */
function vec<T>(elem: T, n: number): Vec<T>;

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

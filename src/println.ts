import { impls, type TraitInstance } from "./lang/index.ts";
import { Debug, FMT } from "./fmt.ts";

type DebugImpl = TraitInstance<typeof Debug>;

type Primitive = string | number | boolean | bigint;

/** `{:?}`: primitives, or anything that nominally implements our Debug trait. */
type HasDebug<T> = T extends Primitive ? true : T extends DebugImpl ? true : false;

/**
 * `{}`: primitives only, for now — there is no Display trait yet.
 * Once one exists, add: `: T extends DisplayImpl ? true : false` to the tail.
 */
type HasDisplay<T> = T extends Primitive ? true : false;

// ---- front-anchored, single left-to-right scan: does the string START WITH this
// token right now? One token (or one plain character) is consumed per step, strictly
// in order — this is what makes escapes interleaved with real placeholders (e.g.
// "{{{}}}") resolve the same way the runtime regex's leftmost-first matching does.
type NextTok<S extends string> = S extends `{{${infer Rest}`
	? ["open", Rest]
	: S extends `}}${infer Rest}`
		? ["close", Rest]
		: S extends `{:?}${infer Rest}`
			? ["debug", Rest]
			: S extends `{}${infer Rest}`
				? ["display", Rest]
				: S extends `${string}${infer Rest}`
					? ["char", Rest]
					: ["done", S];

type ValidateFormat<
	Str extends string,
	Args extends any[],
	Orig extends string = Str,
	Index extends any[] = [],
	Remaining extends string = Str
> =
	NextTok<Remaining> extends [infer Kind extends string, infer Tail extends string]
		? Kind extends "open" | "close" | "char"
			? ValidateFormat<Str, Args, Orig, Index, Tail>
			: Kind extends "done"
				? Index["length"] extends Args["length"]
					? Orig
					: `Error: too many arguments provided (expected ${Index["length"]}, got ${Args["length"]})`
				: Index["length"] extends Args["length"]
					? `Error: missing argument for '${Kind extends "debug" ? "{:?}" : "{}"}' placeholder (expected argument ${Index["length"]})`
					: Kind extends "debug"
						? HasDebug<Args[Index["length"]]> extends true
							? ValidateFormat<Str, Args, Orig, [...Index, any], Tail>
							: `Error: argument ${Index["length"]} does not implement Debug, required for '{:?}'`
						: HasDisplay<Args[Index["length"]]> extends true
							? ValidateFormat<Str, Args, Orig, [...Index, any], Tail>
							: `Error: argument ${Index["length"]} does not implement Display, required for '{}'`
		: never;

const println_impl = (() => {
	// The implementation below has a plain, boring signature on purpose: pairing an
	// overloaded, deeply recursive generic type directly with an implementation body
	// is what triggered "Type instantiation is excessively deep" here (confirmed by
	// testing — a bare `declare function` with the same type never had this problem;
	// only adding a real body did). Casting a simply-typed implementation to the
	// fancy overloaded type sidesteps that check entirely, and the body is identical
	// to what it would otherwise be.
	return function println(format?: string, ...args: unknown[]): void {
		if (format === undefined) return void console.log();

		let next = 0;
		const text = format.replace(/\{\{|\}\}|\{:\?\}|\{\}/g, (token) => {
			if (token === "{{") return "{";
			if (token === "}}") return "}";

			if (next >= args.length)
				throw new Error(`println: no argument for '${token}' placeholder ${next}`);
			const arg = args[next++];

			const is_primitive =
				typeof arg === "string" ||
				typeof arg === "number" ||
				typeof arg === "boolean" ||
				typeof arg === "bigint";

			if (token === "{:?}") {
				if (!is_primitive && !impls(arg, Debug))
					throw new Error(
						`println: argument ${next - 1} (${describe(arg)}) does not implement Debug, required for '{:?}'`
					);
				return debug_str(arg);
			} else {
				if (!is_primitive)
					throw new Error(
						`println: argument ${next - 1} (${describe(arg)}) does not implement Display, required for '{}'`
					);
				return display_str(arg);
			}
		});

		if (next !== args.length)
			throw new Error(`println: ${args.length} arguments given but only ${next} placeholders used`);
		console.log(text);
	};
})();

export const println = println_impl as {
	(): void;
	<Str extends string, Args extends any[]>(format: ValidateFormat<Str, Args>, ...args: Args): void;
};

const describe = (v: unknown) => (v as any)?.constructor?.name ?? typeof v;
const display_str = (arg: unknown): string => (typeof arg === "string" ? arg : String(arg));
const debug_str = (arg: unknown): string => {
	if (typeof arg === "string") return JSON.stringify(arg);
	if (typeof arg === "bigint") return arg.toString().concat("n");
	if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
	return (arg as any)[FMT](0, {}, (v: unknown) => debug_str(v));
};

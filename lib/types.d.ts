import type { Err, Ok } from "../src/result.ts";
import { type None, type Some } from "../src/option.ts";
import type { TraitInstance } from "../src/trait_impl.ts";
import type { AsyncDrop, Container, Drop } from "../src/ops.ts";

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

/**
 * For documenting error messages
 */
export type Msg<M extends string> = { [K in M]: never };

/* ---- union detection ---- */
type IsUnion<T, U = T> = [T] extends [never]
	? false
	: T extends any
		? [U] extends [T]
			? false
			: true
		: never;

/* ---- normalization ----
 * Collapse Option/Result variants so a *homogeneous* Option<A> / Result<A, E> is not seen as a
 * union. None vanishes; Some<U> becomes one marker keyed by U. Ok/Err become one marker keyed
 * by the pair. Everything else passes through untouched.
 */
type Norm<T> =
	T extends Some<infer U>
		? { readonly __option: U }
		: T extends None
			? never
			: T extends Ok<infer V, unknown>
				? { readonly __result_ok: V }
				: T extends Err<infer F, unknown>
					? { readonly __result_err: F }
					: T;

/* bool is `true | false` under the hood, so exempt it from the union test */
type NormInner<U> = [U] extends [boolean] ? never : Norm<U>;

/* is there a mixed type hiding inside an Option / Result? (one level deep) */
type InnerMixed<T> =
	T extends Some<infer U>
		? IsUnion<NormInner<U>>
		: T extends Ok<infer V, unknown>
			? IsUnion<NormInner<V>>
			: T extends Err<infer F, unknown>
				? IsUnion<NormInner<F>>
				: false;

/* ---- the homogeneity rule ---- */
export type Homogeneous<T> = [T] extends [boolean]
	? unknown
	: IsUnion<Norm<T>> extends true
		? Msg<"unions are not allowed: collections must be homogeneous. Wrap mixed values in an enum, or use a trait">
		: true extends InnerMixed<T>
			? Msg<"Option<...> and Result<...> must hold a single type, not a union">
			: unknown;

/* ---- the Drop rule from before: both traits is only allowed for Iterables ---- */
export type DropCheck<T> = [T] extends [
	TraitInstance<typeof AsyncDrop> & TraitInstance<typeof Drop>
]
	? [T] extends [TraitInstance<typeof Container>]
		? unknown
		: Msg<"implements both Drop and AsyncDrop but is not a Container. Remove one trait, or add Container if it owns other values">
	: unknown;

/* ---- the single constraint to use everywhere ---- */
export type CheckElem<T> = Homogeneous<T> & DropCheck<T>;

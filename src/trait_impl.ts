/*
 **  @traits-ts/core - Traits for TypeScript Classes
 **  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
 **  Licensed under MIT license <https://spdx.org/licenses/MIT>
 */

import { is_sub_class_of } from "../lib/is_sub_class.ts";

/* eslint no-use-before-define: off */

/*  ==== UTILITY DEFINITIONS ====  */

/*  utility function: CRC32-hashing a string into a unique identifier  */
const crcTable = [] as number[];
for (let n = 0; n < 256; n++) {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	crcTable[n] = c;
}
const crc32 = (str: string) => {
	let crc = 0 ^ -1;
	for (let i = 0; i < str.length; i++)
		crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xff];
	return (crc ^ -1) >>> 0;
};

/*  utility type and function: constructor (function)  */
export type Cons<T extends any = any> = new (...args: any[]) => T;
export type AbstractCons<T extends any = any> = abstract new (...args: any[]) => T;

/**
 * Any constructor: public concrete, public abstract, **or non-public**
 * (protected / private constructor – no public construct signature).
 */
export type AnyCons<T extends any = any> =
	| Cons<T>
	| AbstractCons<T>
	| (Function & { prototype: T });

const isCons = <T extends any = any>(fn: unknown): fn is Cons<T> =>
	typeof fn === "function" && !!fn.prototype && !!fn.prototype.constructor;

/*  utility type and function: constructor factory (function)  */
type ConsFactory<T extends AnyCons = AnyCons, B extends any = any> = (base: B) => T;

/*  utility type and function: type factory (function)  */
type TypeFactory<T extends any = any> = () => T;
const isTypeFactory = <T extends any = any>(fn: unknown): fn is TypeFactory<T> =>
	typeof fn === "function" && !fn.prototype && fn.length === 0;

/*  Broader type that accepts:
 *  - plain SubTrait
 *  - non-generic type factory  () => SubTrait
 *  - generic type factory      <T>() => SubTrait
 */
type AnyTraitOrFactory = SubTrait | TypeFactory<SubTrait> | ((...args: any[]) => SubTrait);

/*  Type-level check that also accepts generic factories */
type IsTypeFactory<T> = T extends (...args: any[]) => SubTrait ? true : false;

/*  utility type: map an object type into a bare properties type  */
type Explode<T extends any> = { [P in keyof T]: T[P] };

/*  utility type: convert two arrays of types into an array of union types  */
type MixParams<T1 extends any[], T2 extends any[]> = T1 extends []
	? T2 extends []
		? []
		: T2
	: T2 extends []
		? T1
		: T1 extends [infer H1, ...infer R1]
			? T2 extends [infer H2, ...infer R2]
				? [H1 & H2, ...MixParams<R1, R2>]
				: []
			: [];

/*  Loose instance type that still works when the construct signature is missing */
export type LooseInstanceType<T> = T extends abstract new (...args: any) => infer R
	? R
	: T extends new (...args: any) => infer R
		? R
		: // support our type for static readonly
			T extends Function & { readonly __instance: infer I }
			? I
			: T extends Function & { prototype: infer P }
				? P
				: any;

/*  ==== TRAIT DEFINITION ====  */

/*  API: trait type  */
type TraitDefTypeST = (SubTrait | TypeFactory<SubTrait>)[] | undefined;

export interface Trait<T extends AnyCons<any> = AnyCons<any>> {
	id: number /* unique id (primary,   for hasTrait)      */;
	symbol: symbol /* unique id (secondary, currently unused)  */;
	factory: (b: any) => T;
	superTraits: undefined;
}
export interface SubTrait<
	T extends AnyCons<any> = AnyCons<any>,
	ST extends TraitDefTypeST = TraitDefTypeST
> {
	id: number /* unique id (primary,   for hasTrait)      */;
	symbol: symbol /* unique id (secondary, currently unused)  */;
	factory: (b: any) => T;
	superTraits: ST;
}

/**
 * Defines a trait: an abstract class that other classes opt into with `impl(...)`.
 *
 * @remarks Every trait class **must declare `__instance`**, set to the trait class itself:
 *
 * ```typescript
 * declare static readonly __instance: MyTrait;
 * ```
 *
 * Trait classes have a `protected` constructor, which TypeScript refuses to treat as a public
 * construct signature. Without the brand, `TraitInstance<typeof MyTrait>` falls back to the
 * class's `prototype` type, and TypeScript fills every type parameter of that type with `any`.
 * The trait still works, but a generic trait silently loses its type argument:
 * `Clone<string>` would give `clone(): any` instead of `clone(): string`. The brand hands the
 * real instance type to `TraitInstance`, so the generic survives.
 *
 * - **Where:** inside the abstract class, next to its other members.
 * - **Cost:** none at runtime. `declare` emits nothing.
 * - **Which traits:** always add it, for a single rule. It only matters for generic traits, but
 *   it is harmless on the others.
 * - **Forgetting it is silent.** Check by hovering `TraitInstance<typeof MyTrait<string>>`: it
 *   should read `MyTrait<string>.MyTrait`, not `MyTrait<any>.MyTrait`.
 * - **Limit:** this works because a trait's `T` belongs to the factory function, not the class.
 *   A normal generic class cannot do the same, since static members cannot reference class type
 *   parameters.
 *
 * @example
 * ```typescript
 * // a generic trait: `T` is the factory's type parameter, used by the abstract member
 * export const Clone = <T>() =>
 * 	trait((b) => {
 * 		abstract class Clone extends b {
 * 			declare static readonly __instance: Clone;
 * 			abstract clone(): T;
 * 			protected constructor(...args: any[]) {
 * 				super(...args);
 * 			}
 * 		}
 * 		return Clone;
 * 	});
 *
 * class Point extends impl(Clone<Point>) {
 * 	clone(): Point { ... }
 * }
 * ```
 */
/* eslint no-redeclare: off */
export function trait<T extends ConsFactory<AnyCons>>(factory: T): Trait<ReturnType<T>>;

/**
 * Defines a trait that requires other traits (its supertraits).
 *
 * @remarks Same rules as the regular variant, including the `__instance` brand: declare
 * `declare static readonly __instance: MyTrait;` in the class, or a generic trait loses its type
 * argument without any error. Anything that implements this trait must also implement its
 * supertraits, and `factory` receives a base that already includes them.
 *
 * @example
 * ```typescript
 * const Printable = trait([Debug], (b) => {
 * 	abstract class Printable extends b {
 * 		declare static readonly __instance: Printable;
 * 		abstract print(): void;
 * 		protected constructor(...args: any[]) {
 * 			super(...args);
 * 		}
 * 	}
 * 	return Printable;
 * });
 * ```
 */
export function trait<
	const ST extends (SubTrait | TypeFactory<SubTrait>)[],
	T extends ConsFactory<
		AnyCons,
		// @ts-ignore
		// oxlint-disable-next-line no-unused-vars
		ST extends [infer First, ...infer Rest]
			? First extends TypeFactory<SubTrait>
				? ExtractFactory<ReturnType<First>>
				: First extends SubTrait
					? ExtractFactory<First>
					: any
			: any
	>
>(superTraits: ST, factory: T): SubTrait<ReturnType<T>, ST>;

/*  API: generate trait (technical implementation)  */
export function trait(...args: any[]): SubTrait<any, any> {
	const factory = args.length === 2 ? args[1] : args[0];
	const superTraits = args.length === 2 ? args[0] : undefined;
	return {
		id: crc32(factory.toString()),
		symbol: Symbol("trait"),
		factory,
		superTraits
	};
}

/*  ==== TRAIT DERIVATION ====  */

/*  ---- TRAIT PART EXTRACTION ----  */

/*  utility types: extract factory from a trait  */
type ExtractFactory<T extends SubTrait> = T extends SubTrait<infer C, TraitDefTypeST> ? C : never;

/*  utility types: extract supertraits from a trait  */
type ExtractSuperTrait<T extends SubTrait> =
	T extends SubTrait<AnyCons<any>, infer ST extends TraitDefTypeST> ? ST : never;

/*  ---- TRAIT CONSTRUCTOR DERIVATION ----  */

/*  utility type: is this constructor concrete (has a public `new` signature)?  */
type IsConcreteCons<C> = C extends new (...args: any[]) => any ? true : false;

/*  utility type: constructor type that is concrete only if the flag says so  */
type ConsOf<Concrete extends boolean, Args extends any[], R> = Concrete extends true
	? new (...args: Args) => R
	: abstract new (...args: Args) => R;

/*  utility type: derive type constructor: merge two constructors  */
type DeriveTraitsConsConsMerge<A extends AnyCons, B extends AnyCons> = A extends abstract new (
	...args: infer ArgsA
) => infer RetA
	? B extends abstract new (...args: infer ArgsB) => infer RetB
		? ConsOf<
				IsConcreteCons<A> extends true ? IsConcreteCons<B> : false,
				MixParams<ArgsA, ArgsB>,
				RetA & RetB
			>
		: /* B has no public construct signature */
			ConsOf<IsConcreteCons<A>, ArgsA, RetA & LooseInstanceType<B>>
	: B extends abstract new (...args: infer ArgsB) => infer RetB
		? /* A has no public construct signature */
			ConsOf<IsConcreteCons<B>, ArgsB, LooseInstanceType<A> & RetB>
		: /* both non-public → abstract constructor with merged instance type */
			abstract new (...args: any[]) => LooseInstanceType<A> & LooseInstanceType<B>;

/*  utility type: derive type constructor: extract plain constructor  */
type DeriveTraitsConsCons<T extends AnyCons> = T extends abstract new (...args: any) => any
	? ConsOf<IsConcreteCons<T>, ConstructorParameters<T>, InstanceType<T>>
	: /* no public construct signature → treat as abstract */
		abstract new (...args: any[]) => LooseInstanceType<T>;

/*  utility type: derive type constructor: from trait parts  */
type DeriveTraitsConsTraitParts<
	C extends AnyCons,
	ST extends (SubTrait | TypeFactory<SubTrait>)[] | undefined
> = ST extends undefined
	? DeriveTraitsConsCons<C>
	: ST extends []
		? DeriveTraitsConsCons<C>
		: DeriveTraitsConsConsMerge<DeriveTraitsConsCons<C>, DeriveTraitsConsAll<ST>>; /* RECURSION */

/*  utility type: derive type constructor: from single trait  */
type DeriveTraitsConsTrait<T extends SubTrait> = DeriveTraitsConsTraitParts<
	ExtractFactory<T>,
	ExtractSuperTrait<T>
>;

/*  utility type: derive type constructor: from single trait or trait factory
 *  (accepts plain SubTrait, () => SubTrait, and <T>() => SubTrait)
 */
type DeriveTraitsConsOne<T extends AnyTraitOrFactory> = T extends SubTrait
	? DeriveTraitsConsTrait<T>
	: IsTypeFactory<T> extends true
		? T extends (...args: any[]) => infer R
			? R extends SubTrait
				? DeriveTraitsConsTrait<R>
				: never
			: never
		: never;

/*  utility type: derive type constructor: from one or more traits or trait factories  */
type DeriveTraitsConsAll<
	T extends (AnyTraitOrFactory[] | [...AnyTraitOrFactory[], AnyCons]) | undefined
> =
	/*  1st: a pure list of traits / trait factories (checked first, because `AnyCons`
	 *  also matches any function type and would otherwise swallow a trailing factory)  */
	T extends AnyTraitOrFactory[]
		? T extends [infer First extends AnyTraitOrFactory]
			? DeriveTraitsConsOne<First>
			: T extends [infer First extends AnyTraitOrFactory, ...infer Rest extends AnyTraitOrFactory[]]
				? DeriveTraitsConsConsMerge<
						DeriveTraitsConsOne<First>,
						DeriveTraitsConsAll<Rest>
					> /* RECURSION */
				: never
		: /*  2nd: traits followed by a trailing regular class  */
			T extends [...infer Others extends AnyTraitOrFactory[], infer Last extends AnyCons]
			? DeriveTraitsConsConsMerge<
					DeriveTraitsConsAll<Others> /* RECURSION */,
					DeriveTraitsConsCons<Last>
				>
			: never;

/*  utility type: derive type constructor  */
type DeriveTraitsCons<T extends AnyTraitOrFactory[] | [...AnyTraitOrFactory[], AnyCons]> =
	DeriveTraitsConsAll<T>;

/*  ---- TRAIT STATICS DERIVATION ----  */

/*  utility type: derive type statics: merge two objects with statics  */
type DeriveTraitsStatsConsMerge<T1 extends {}, T2 extends {}> = T1 & T2;

/*  utility type: derive type statics: extract plain statics  */
type DeriveTraitsStatsCons<T extends AnyCons> = Explode<T>;

/*  utility type: derive type statics: from trait parts  */
type DeriveTraitsStatsTraitParts<
	C extends AnyCons,
	ST extends (SubTrait | TypeFactory<SubTrait>)[] | undefined
> = ST extends undefined
	? DeriveTraitsStatsCons<C>
	: ST extends []
		? DeriveTraitsStatsCons<C>
		: DeriveTraitsStatsConsMerge<
				DeriveTraitsStatsCons<C>,
				DeriveTraitsStatsAll<ST>
			>; /* RECURSION */

/*  utility type: derive type statics: from single trait  */
type DeriveTraitsStatsTrait<T extends SubTrait> = DeriveTraitsStatsTraitParts<
	ExtractFactory<T>,
	ExtractSuperTrait<T>
>;

/*  utility type: derive type statics: from single trait or trait type factory  */
type DeriveTraitsStatsOne<T extends AnyTraitOrFactory> = T extends SubTrait
	? DeriveTraitsStatsTrait<T>
	: IsTypeFactory<T> extends true
		? T extends (...args: any[]) => infer R
			? R extends SubTrait
				? DeriveTraitsStatsTrait<R>
				: never
			: never
		: never;

/*  utility type: derive type statics: from one or more traits or trait factories  */
type DeriveTraitsStatsAll<
	T extends (AnyTraitOrFactory[] | [...AnyTraitOrFactory[], AnyCons]) | undefined
> =
	/*  1st: a pure list of traits / trait factories (see DeriveTraitsConsAll)  */
	T extends AnyTraitOrFactory[]
		? T extends [infer First extends AnyTraitOrFactory]
			? DeriveTraitsStatsOne<First>
			: T extends [infer First extends AnyTraitOrFactory, ...infer Rest extends AnyTraitOrFactory[]]
				? DeriveTraitsStatsConsMerge<
						DeriveTraitsStatsOne<First>,
						DeriveTraitsStatsAll<Rest>
					> /* RECURSION */
				: never
		: /*  2nd: traits followed by a trailing regular class  */
			T extends [...infer Others extends AnyTraitOrFactory[], infer Last extends AnyCons]
			? DeriveTraitsStatsConsMerge<
					DeriveTraitsStatsAll<Others> /* RECURSION */,
					DeriveTraitsStatsCons<Last>
				>
			: never;

/*  utility type: derive type statics  */
type DeriveTraitsStats<T extends AnyTraitOrFactory[] | [...AnyTraitOrFactory[], AnyCons]> =
	DeriveTraitsStatsAll<T>;

/*  ---- TRAIT DERIVATION ----  */

/*  traits-only half, as an abstract mixin ctor. `unknown` = identity for `&`  */
type TraitsMixin<Ts extends AnyTraitOrFactory[]> = Ts extends []
	? unknown
	: abstract new (...args: any[]) => LooseInstanceType<DeriveTraitsConsAll<Ts>>;

type TraitsStats<Ts extends AnyTraitOrFactory[]> = Ts extends []
	? unknown
	: DeriveTraitsStatsAll<Ts>;

type DeriveTraits<T extends AnyTraitOrFactory[] | [...AnyTraitOrFactory[], AnyCons]> =
	/* 1st: pure trait list. Must stay first: AnyCons matches any function */
	T extends AnyTraitOrFactory[]
		? DeriveTraitsCons<T> & DeriveTraitsStats<T>
		: /* 2nd: traits + base. Base stays WHOLE, so its generics survive */
			T extends [...infer Others extends AnyTraitOrFactory[], infer Last extends AnyCons]
			? Last & TraitsMixin<Others> & TraitsStats<Others>
			: never;

/*  ---- TRAIT DERIVATION RUNTIME ----  */

/*  utility function: add an additional invisible property to an object  */
const extendProperties = (cons: AnyCons, field: string | symbol, value: any) =>
	Object.defineProperty(cons, field, { value, enumerable: false, writable: false });

/*  utility function: get raw trait  */
const rawTrait = (x: SubTrait | TypeFactory<SubTrait>) => (isTypeFactory(x) ? x() : x);

/*  utility function: derive a trait  */
const deriveTrait = (
	trait$: SubTrait | TypeFactory<SubTrait>,
	baseClz: AnyCons<any>,
	derived: Map<number, boolean>
) => {
	/*  get real trait  */
	const trait = rawTrait(trait$);

	/*  start with base class  */
	let clz = baseClz;

	/*  in case we still have not derived this trait...  */
	if (!derived.has(trait.id)) {
		derived.set(trait.id, true);

		/*  iterate over all of its super traits  */
		if (trait.superTraits !== undefined)
			for (const superTrait of reverseTraitList(trait.superTraits))
				clz = deriveTrait(superTrait, clz, derived); /*  RECURSION  */

		/*  derive this trait  */
		clz = trait.factory(clz);
		extendProperties(clz, "id", crc32(trait.factory.toString()));
		extendProperties(clz, trait.symbol, true);
	}

	return clz;
};

/*  utility function: get reversed trait list  */
const reverseTraitList = (traits: (SubTrait | TypeFactory<SubTrait>)[]) =>
	traits.slice().reverse() as (SubTrait | TypeFactory<SubTrait>)[];

// type AbstractCtor<I = {}> = abstract new (...args: any[]) => I;

// // union -> intersection
// type U2I<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
//
// // merge every trait's instance type into one intersection.
// // Mapped tuple -> [number] gives a union of instances -> U2I makes it an intersection.
// type MergeTraits<Ts extends readonly unknown[]> =
//   [Ts[number]] extends [never]
//     ? {}
//     : U2I<{ [K in keyof Ts]: TraitInstance<Ts[K]> }[number]>;
//
// type DeriveTraitsSecond<T extends readonly unknown[]> =
//   T extends [...infer Init, infer Last]
//     ? Last extends AnyTraitOrFactory            // check trait FIRST, it's the more specific shape
//       ? AbstractCtor<MergeTraits<T>>            // impl(A, B, C)
//       : Last & AbstractCtor<MergeTraits<Init>>  // impl(A, B, BaseCons): Base keeps its generics
//     : never;

/**
     *
     T extends [...AnyTraitOrFactory[], infer B]
		? T extends [...infer A, AnyCons]
			? A[number] extends SubTrait<infer C>
				? C & B
				: any
			: any
		: any
     */
/** implement trait  */
export function impl<
	T extends [AnyTraitOrFactory, ...AnyTraitOrFactory[]] | [...AnyTraitOrFactory[], AnyCons]
>(...traits: T): DeriveTraits<T> {
	/*  run-time sanity check  */
	if (traits.length === 0)
		throw new Error("invalid number of parameters (expected one or more traits)");

	/*  determine the base class (clz) and the list of traits (lot)  */
	let clz: AnyCons<any>;
	let lot: (SubTrait | TypeFactory<SubTrait>)[];
	const last = traits[traits.length - 1];
	if (isCons(last) && !isTypeFactory(last)) {
		/*  case 1: with trailing regular class  */
		clz = last;
		lot = traits.slice(0, -1) as (SubTrait | TypeFactory<SubTrait>)[];
	} else {
		/*  case 2: just regular traits or trait type factories  */
		clz = class ROOT {};
		lot = traits as (SubTrait | TypeFactory<SubTrait>)[];
	}

	/*  track already derived traits  */
	const derived = new Map<number, boolean>();

	/*  iterate over all traits  */
	for (const trait of reverseTraitList(lot)) clz = deriveTrait(trait, clz, derived);

	return clz as any;
	// return clz as DeriveTraits<T>;
}

/*  ==== TRAIT TYPE-GUARDING ====  */

/*  internal type: implements trait type  */
type DerivedType<T extends SubTrait> = LooseInstanceType<ExtractFactory<T>>;

/*  internal type: implements trait type or trait type factory  */
type Derived<T extends SubTrait | TypeFactory<SubTrait> | Cons> =
	T extends TypeFactory<SubTrait>
		? DerivedType<ReturnType<T>>
		: T extends SubTrait
			? DerivedType<T>
			: T extends Cons
				? T
				: never;

/**  the instance type a trait value (or trait type factory) describes
 * TraitInstance<typeof PartialEq<T>>
 */
export type TraitInstance<T extends SubTrait | TypeFactory<SubTrait>> =
	T extends TypeFactory<SubTrait>
		? DerivedType<ReturnType<T>>
		: T extends SubTrait
			? DerivedType<T>
			: never;

/**  the constructor type a trait value (or trait type factory) describes
 * TraitConstructor<typeof PartialEq<any>>
 */
export type TraitConstructor<T extends SubTrait | TypeFactory<SubTrait>> =
	T extends TypeFactory<SubTrait<infer A>> ? A : T extends SubTrait<infer B> ? B : never;

function is_strict_class(value: any) {
	if (typeof value !== "function") return false;
	const descriptor = Object.getOwnPropertyDescriptor(value, "prototype");
	// Built-in functions like Math.max don't have a prototype, while classes always do
	return descriptor ? !descriptor.writable : false;
}

/**
 * type guard for checking whether class instance or class itself
 * implements a trait
 *
 * @example
 * ``typescript
 * type Check = Impls<typeof Slice<any>, typeof Debug>
 * // hover on Check shows true
 * const my_vec = Vec.with_capacity(0);
 * type Check = Impls<typeof my_vec, typeof Debug>
 * // hover on Check shows true
 * ``
 */
export type Impls<T, U extends SubTrait | TypeFactory<SubTrait>> =
	T extends TraitInstance<U> ? true : T extends TraitConstructor<U> ? true : false;

/**
 * type guard for checking whether class instance or class itself implements a trait
 *
 * @example
 * ``typescript
 * if (impls(Vec<number>, Debug)) {}
 * ``
 * @example
 * ``typescript
 * if (impls(new Vec<number>(0), Debug)) {}
 * ``
 */
export function impls<T extends SubTrait | TypeFactory<SubTrait> | Cons>(
	instance_or_class: unknown,
	trait: T
): instance_or_class is Derived<T> {
	/*  ensure the class instance is really an object  */
	if (
		is_strict_class(instance_or_class) ||
		(typeof instance_or_class === "object" && instance_or_class !== null)
	) {
		let obj = instance_or_class;

		/*  special case: regular class  */
		if (isCons(trait) && !isTypeFactory(trait)) {
			if (is_strict_class(instance_or_class))
				return is_sub_class_of(instance_or_class as any, trait);
			else return instance_or_class instanceof trait;
		}

		/*  regular case: trait or trait type factory...  */
		const t = (isTypeFactory(trait) ? trait() : trait) as SubTrait;
		const trait_id = t["id"];

		// class itself like Vec<T>
		if (is_strict_class(instance_or_class)) {
			let current = instance_or_class;

			// Traverse up the prototype chain
			while (current !== null) {
				if (Object.getPrototypeOf(current)?.["id"] === trait_id) return true;
				current = Object.getPrototypeOf(current);
			}
		}

		// class instance like new Vec<number>
		while (obj) {
			if (Object.hasOwn(obj, "constructor")) {
				const id = ((obj.constructor as any)["id"] as number) ?? 0;
				if (id === trait_id) return true;
			}
			obj = Object.getPrototypeOf(obj);
		}
	}
	return false;
}

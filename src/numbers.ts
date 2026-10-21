import { Prettify } from "../lib/types";
import { Clone } from "./clone";
import { PartialEq } from "./cmp";
import { Debug, FMT } from "./fmt";
import { match } from "./match";
import { Result } from "./result";
import { impl, TraitInstance } from "./trait";

export type Int<K extends string> = number & { readonly __num?: K };
export type UInt<K extends string> = number & { readonly __num?: K };
export type BigInt_<K extends string> = bigint & { readonly __num?: K };
export type BigUInt_<K extends string> = bigint & { readonly __num?: K };
export type Float<K extends string> = number & { readonly __num?: K };

// digit arithmetic
// Compares decimal strings, so the cost is the number of digits (at most 39
// for u128), not the number of legal values.

export type Chars<S extends string, A extends 0[] = []> = S extends `${string}${infer R}`
  ? Chars<R, [...A, 0]>
  : A;

// compares lengths: "lt" = S shorter than M, "eq" = same length, "gt" = S longer
type Cmp<S extends string, M extends string> =
  Chars<M> extends [...Chars<S>, ...infer Rest] ? (Rest extends [] ? "eq" : "lt") : "gt";

// A < B for single digits, using "0123456789" as an ordering table
type DigitLt<
  A extends string,
  B extends string,
> = "0123456789" extends `${string}${A}${infer After}`
  ? After extends `${string}${B}${string}`
    ? true
    : false
  : false;

// A <= B for digit strings of EQUAL length
type SameLenLte<A extends string, B extends string> = A extends B
  ? true
  : A extends `${infer A0}${infer AR}`
    ? B extends `${infer B0}${infer BR}`
      ? A0 extends B0
        ? SameLenLte<AR, BR>
        : DigitLt<A0, B0>
      : false
    : true;

// A <= B for non-negative integer digit strings of any length
type MagLte<A extends string, B extends string> =
  Cmp<A, B> extends "lt" ? true : Cmp<A, B> extends "eq" ? SameLenLte<A, B> : false;

// ------------------------------------------------------------ integer range

type IsWide<N> = number extends N ? true : bigint extends N ? true : false; // not a literal
type IsPlainInt<S extends string> = S extends `${string}${"." | "e" | "E"}${string}` ? false : true;

/**
 * N (a literal) must satisfy  -MinMag <= N <= Max  (MinMag and Max are decimal strings).
 * Non-literals pass; bad literals become `never`, which is what produces the error.
 */
type InRange<N extends number | bigint, MinMag extends string, Max extends string> =
  IsWide<N> extends true
    ? N
    : IsPlainInt<`${N}`> extends true
      ? `${N}` extends `-${infer Mag}`
        ? MagLte<Mag, MinMag> extends true
          ? N
          : never
        : MagLte<`${N}`, Max> extends true
          ? N
          : never
      : never;

// ----------------------------------------------------------------- unsigned

export type u8 = UInt<"u8">;
export type u16 = UInt<"u16">;
export type u32 = UInt<"u32">;
export type u64 = BigUInt_<"u64">;
export type u128 = BigUInt_<"u128">;
export type usize = UInt<"usize">; // 32-bit: JS array indices stop at 2^32 - 1

const uint_type = <N extends number>(min: number, max: number) => {
  return {
    MIN: min as N,
    MAX: max as N,
    is: (n: number): n is N => Number.isInteger(n) && n >= min && n <= max,
    try_from(n: number): Result<N, string> {
      return this.is(n)
        ? Result.Ok(n)
        : Result.Err("out of range integral type conversion attempted");
    },
  };
};

const int_type = uint_type;

const big_uint_type = <N extends bigint>(min: bigint, max: bigint) => {
  return {
    MIN: min as N,
    MAX: max as N,
    // is is integer here?
    is: (n: bigint): n is N => typeof n === "bigint" && n >= min && n <= max,
    try_from(n: bigint): Result<N, string> {
      return this.is(n)
        ? Result.Ok(n)
        : Result.Err("out of range integral type conversion attempted");
    },
  };
};

const big_int_type = big_uint_type;

// type _AsInterface<T> = T extends (...args: infer Args) => infer Return
//   ? { (...args: Args): Return } & { [K in keyof T]: T[K] }
//   : T;

function object_assign<T extends {}, U>(target: T, source: U) {
  return Object.assign(target, source);
}

interface UIntType<N extends number> {
  /** largest finite value */
  MAX: N;
  /** most negative finite value */
  MIN: N;
  is(n: number): n is N;
  try_from(n: number): Result<N, string>;
}

export interface U8 extends Prettify<UIntType<u8>> {
  <const N extends number>(n: InRange<N, "0", "255">): u8;
}
export interface U16 extends Prettify<UIntType<u16>> {
  <const N extends number>(n: InRange<N, "0", "65535">): u16;
}
export interface U32 extends Prettify<UIntType<u32>> {
  <const N extends number>(n: InRange<N, "0", "4294967295">): u32;
}
export interface USize extends Prettify<UIntType<usize>> {
  <const N extends number>(n: InRange<N, "0", "4294967295">): usize;
}

interface BigUIntType<N extends bigint> {
  /** largest finite value */
  MAX: N;
  /** most negative finite value */
  MIN: N;
  is(n: bigint): n is N;
  try_from(n: bigint): Result<N, string>;
}
export interface U64 extends Prettify<BigUIntType<u64>> {
  <const N extends bigint>(n: InRange<N, "0", "18446744073709551615">): u64;
}
export interface U128 extends Prettify<BigUIntType<u128>> {
  <const N extends bigint>(n: InRange<N, "0", "340282366920938463463374607431768211455">): u128;
}

export const u8: U8 = object_assign(
  <const N extends number>(n: InRange<N, "0", "255">): u8 => {
    if (!(Number.isInteger(n) && n >= 0 && n <= 255))
      throw new Error(`literal out of range for u8: ${n}`);
    return n;
  },
  uint_type<u8>(0, 255),
);
export const u16: U16 = object_assign(
  <const N extends number>(n: InRange<N, "0", "65535">): u16 => {
    if (!(Number.isInteger(n) && n >= 0 && n <= 65535))
      throw new Error(`literal out of range for u16: ${n}`);
    return n;
  },
  uint_type<u16>(0, 65535),
);
export const u32: U32 = object_assign(
  <const N extends number>(n: InRange<N, "0", "4294967295">): u32 => {
    if (!(Number.isInteger(n) && n >= 0 && n <= 4294967295))
      throw new Error(`literal out of range for u32: ${n}`);
    return n;
  },
  uint_type<u32>(0, 4294967295),
);
export const usize: USize = object_assign(
  <const N extends number>(n: InRange<N, "0", "4294967295">): usize => {
    if (!(Number.isInteger(n) && n >= 0 && n <= 4294967295))
      throw new Error(`literal out of range for usize: ${n}`);
    return n;
  },
  uint_type<usize>(0, 4294967295),
);
export const u64: U64 = object_assign(
  <const N extends bigint>(n: InRange<N, "0", "18446744073709551615">): u64 => {
    if (!(typeof n === "bigint" && n >= 0n && n <= 18446744073709551615n))
      throw new Error(`literal out of range for u64: ${n}`);
    return n;
  },
  big_uint_type<u64>(0n, 18446744073709551615n),
);
export const u128: U128 = object_assign(
  <const N extends bigint>(n: InRange<N, "0", "340282366920938463463374607431768211455">): u128 => {
    if (!(typeof n === "bigint" && n >= 0n && n <= 340282366920938463463374607431768211455n))
      throw new Error(`literal out of range for u128: ${n}`);
    return n;
  },
  big_uint_type<u128>(0n, 340282366920938463463374607431768211455n),
);

// ------------------------------------------------------------------- signed
// MinMag is the magnitude of the minimum (i8: -128 -> "128").

export type i8 = Int<"i8">;
export type i16 = Int<"i16">;
export type i32 = Int<"i32">;
export type i64 = BigInt_<"i64">;
export type i128 = BigInt_<"i128">;
export type isize = Int<"isize">; // 32-bit, like usize

interface IntType<N extends number> {
  /** largest finite value */
  MAX: N;
  /** most negative finite value */
  MIN: N;
  is(n: number): n is N;
  try_from(n: number): Result<N, string>;
}

export interface I8 extends Prettify<IntType<i8>> {
  <const N extends number>(n: InRange<N, "128", "127">): i8;
}
export interface I16 extends Prettify<IntType<i16>> {
  <const N extends number>(n: InRange<N, "32768", "32767">): i16;
}
export interface I32 extends Prettify<IntType<i32>> {
  <const N extends number>(n: InRange<N, "2147483648", "2147483647">): i32;
}
export interface ISize extends Prettify<IntType<isize>> {
  <const N extends number>(n: InRange<N, "2147483648", "2147483647">): isize;
}

interface BigIntType<N extends bigint> {
  /** largest finite value */
  MAX: N;
  /** most negative finite value */
  MIN: N;
  is(n: bigint): n is N;
  try_from(n: bigint): Result<N, string>;
}
export interface I64 extends Prettify<BigIntType<i64>> {
  <const N extends bigint>(n: InRange<N, "9223372036854775808", "9223372036854775807">): i64;
}
export interface I128 extends Prettify<BigIntType<i128>> {
  <const N extends bigint>(
    n: InRange<
      N,
      "170141183460469231731687303715884105728",
      "170141183460469231731687303715884105727"
    >,
  ): i128;
}

export const i8: I8 = object_assign(
  <const N extends number>(n: InRange<N, "128", "127">): i8 => {
    if (!(Number.isInteger(n) && n >= -128 && n <= 127))
      throw new Error(`literal out of range for i8: ${n}`);
    return n;
  },
  int_type<i8>(-128, 127),
);
export const i16: I16 = object_assign(
  <const N extends number>(n: InRange<N, "32768", "32767">): i16 => {
    if (!(Number.isInteger(n) && n >= -32768 && n <= 32767))
      throw new Error(`literal out of range for i16: ${n}`);
    return n;
  },
  int_type<i16>(-32768, 32767),
);
export const i32: I32 = object_assign(
  <const N extends number>(n: InRange<N, "2147483648", "2147483647">): i32 => {
    if (!(Number.isInteger(n) && n >= -2147483648 && n <= 2147483647))
      throw new Error(`literal out of range for i32: ${n}`);
    return n;
  },
  int_type<i32>(-2147483648, 2147483647),
);
export const isize: ISize = object_assign(
  <const N extends number>(n: InRange<N, "2147483648", "2147483647">): isize => {
    if (!(Number.isInteger(n) && n >= -2147483648 && n <= 2147483647))
      throw new Error(`literal out of range for isize: ${n}`);
    return n;
  },
  int_type<isize>(-2147483648, 2147483647),
);
export const i64: I64 = object_assign(
  <const N extends bigint>(n: InRange<N, "9223372036854775808", "9223372036854775807">): i64 => {
    if (!(typeof n === "bigint" && n >= -9223372036854775808n && n <= 9223372036854775807n))
      throw new Error(`literal out of range for i64: ${n}`);
    return n;
  },
  big_int_type<i64>(-9223372036854775808n, 9223372036854775807n),
);
export const i128: I128 = object_assign(
  <const N extends bigint>(
    n: InRange<
      N,
      "170141183460469231731687303715884105728",
      "170141183460469231731687303715884105727"
    >,
  ): i128 => {
    if (
      !(
        typeof n === "bigint" &&
        n >= -170141183460469231731687303715884105728n &&
        n <= 170141183460469231731687303715884105727n
      )
    )
      throw new Error(`literal out of range for i128: ${n}`);
    return n;
  },
  big_int_type<i128>(
    -170141183460469231731687303715884105728n,
    170141183460469231731687303715884105727n,
  ),
);

// ------------------------------------------------------------------- floats
// Bounds only: every float is still a plain JS number (an f64) and is never
// rounded or changed, so f32(0.1) gives back 0.1. Precision is not emulated.
// f64 accepts any number literal. f32 rejects literals above ~3.4028235e38
// (Rust's `overflowing_literals`). Big literals print as "d.ddde+NN", so we
// compare the exponent first, then the mantissa digits. The f32 limit is an
// approximation of the exact rounding boundary.

type NoDot<S extends string> = S extends `${infer I}.${infer F}` ? `${I}${F}` : S;

type PadRight20<S extends string> = Chars<S>["length"] extends 20 ? S : PadRight20<`${S}0`>;

type F32Mag<S extends string> = S extends `${infer M}e+${infer E}`
  ? MagLte<E, "37"> extends true
    ? true
    : E extends "38"
      ? SameLenLte<PadRight20<NoDot<M>>, "34028235000000000000">
      : false
  : true; // no exponent means below 1e21, which always fits

type F32Ok<N extends number> = `${N}` extends `-${infer S}` ? F32Mag<S> : F32Mag<`${N}`>;

export type f32 = Float<"f32">;
export type f64 = Float<"f64">;

interface FloatConstants<F extends number> {
  /** largest finite value */
  MAX: F;
  /** most negative finite value (-MAX; floats differ from ints here) */
  MIN: F;
  /** smallest positive normal value */
  MIN_POSITIVE: F;
  /** gap between 1.0 and the next representable value */
  EPSILON: F;
  INFINITY: F;
  NEG_INFINITY: F;
  NAN: F;
}

interface FloatType<F extends number> extends FloatConstants<F> {
  /** true for any number that does not overflow this type. NaN and +-Infinity are valid floats. */
  is(n: number): n is F;
  /** Ok(n) unchanged, or Err if a finite number overflows this type. */
  try_from(n: number): Result<F, string>;
}

export interface F32 extends Prettify<FloatType<f32>> {
  <const N extends number>(n: number extends N ? N : F32Ok<N> extends true ? N : never): f32;
}
export interface F64 extends Prettify<FloatType<f64>> {
  <const N extends number>(n: N): f64;
}

function float_type<F extends number>(
  limits: { max: number; min_positive: number; epsilon: number },
  // Math.fround for f32, identity for f64. Only used to detect overflow (a finite
  // number overflows when rounding it gives +-Infinity); values are never rounded.
  round: (n: number) => number,
): FloatType<F> {
  const is = (n: number): n is F =>
    typeof n === "number" && (!Number.isFinite(n) || Number.isFinite(round(n)));
  return {
    MAX: limits.max as F,
    MIN: -limits.max as F,
    MIN_POSITIVE: limits.min_positive as F,
    EPSILON: limits.epsilon as F,
    INFINITY: Infinity as F,
    NEG_INFINITY: -Infinity as F,
    NAN: NaN as F,
    is,
    try_from(n: number): Result<F, string> {
      return is(n) ? Result.Ok(n) : Result.Err("out of range floating point conversion attempted");
    },
  };
}

const f32_type = float_type<f32>(
  {
    max: 3.4028234663852886e38,
    min_positive: 1.1754943508222875e-38,
    epsilon: 1.1920928955078125e-7,
  },
  Math.fround,
);

/**
 * Bounds only: the value stays a plain JS number and is returned unchanged (f32(0.1) is 0.1).
 * Math.fround is used only to detect overflow, following Rust's rule that a value overflows
 * when it would round to +-Infinity. f32 precision is not emulated.
 */
export const f32: F32 = object_assign((n: number): f32 => {
  if (!f32_type.is(n)) throw new Error(`literal out of range for f32: ${n}`);
  return n;
}, f32_type);

export const f64: F64 = object_assign(
  (n: number): f64 => {
    if (typeof n !== "number") throw new Error(`expected a number for f64, got ${typeof n}`);
    return n as f64;
  },
  float_type<f64>(
    { max: Number.MAX_VALUE, min_positive: 2.2250738585072014e-308, epsilon: Number.EPSILON },
    (n) => n,
  ),
);

// A decimal is a whole number (the mantissa) and a `scale` (digits after the point):
// value = mantissa / 10^scale, the same model as the rust_decimal crate. The scale is
// part of the value, so "0.10000" keeps its five places and prints back as "0.10000".
// The mantissa is a private field of DecimalImpl, so it is not part of the public API.
//
// Decimals are built from strings. A JS number cannot hold trailing zeros (0.10000 is
// just 0.1) and is already a binary approximation by the time we would see it.
//
// A decimal is an opaque object, not a string, so that operators do not work on it:
// TS rejects `a + b`, and at runtime every operator throws (see Symbol.toPrimitive).
// Arithmetic is done with methods instead: a.add(b), a.mul(b), ... They never mutate:
// every one returns a new decimal, and the bigint math stays inside DecimalImpl.

type DecimalKind = "d32" | "d64" | "d128";
export default DecimalKind;

export interface Decimal<
  K extends DecimalKind = DecimalKind,
  S extends number = number,
  P extends number = number,
> extends TraitInstance<typeof Clone<DecimalOf<K, S, P>>> {
  readonly kind: K;
  /** type-only: the significant digits when known. It does not exist at runtime. */
  readonly digits?: P;
  /** how many digits come after the point: "-1.50" has scale 2 */
  readonly scale: S;
  /** always keeps the scale, e.g. "1.50" */
  to_string(): string;
  /** a string, never a JSON number, so the exact value survives JSON.stringify */
  toJSON(): string;

  // The argument is a decimal of the same kind (mixing kinds is a type error, and throws)
  // or an integer. Floats are not accepted: a float already carries binary error (0.1 + 0.2
  // is 0.30000000000000004), and NaN and Infinity are not decimals. A result that does not
  // fit the kind's digit limit throws. The result types are written as d32<S>, d64<S> and
  // d128<S> (see DecimalOf) so hovers and errors show exactly which kind you are using.

  /** this + other. The scale is the larger of the two: 0.10000 + 0.3222 is 0.42220. */
  add<T extends number>(other: DecimalOf<K, T>): DecimalOf<K, MaxScale<S, T>>;
  /** this + an integer (scale 0). Floats are not accepted. */
  add<const N extends IntLike>(other: IntArg<N>): DecimalOf<K, S>;

  /** this - other. The scale is the larger of the two. */
  sub<T extends number>(other: DecimalOf<K, T>): DecimalOf<K, MaxScale<S, T>>;
  /** this - an integer (scale 0). Floats are not accepted. */
  sub<const N extends IntLike>(other: IntArg<N>): DecimalOf<K, S>;

  /**
   * this * other. The scale is the sum of the two, so 1.5 * 1.5 is 2.25. A sum over the
   * kind's scale limit is a compile error.
   */
  mul<T extends number, Q extends number, SS extends number, D extends number>(
    this: { readonly scale: SS; readonly digits?: D } & MulGuard<K, SS, T, D, Q>,
    other: DecimalOf<K, T, Q>,
  ): DecimalOf<K, SumScale<SS, T>, MulDigits<D, Q>>;
  /** this * an integer (scale 0). Floats are not accepted. */
  mul<const N extends IntLike>(other: IntArg<N>): DecimalOf<K, S>;

  /**
   * this / other, only when the answer is exact. It keeps the places the numbers have
   * (6.00 / 3 is 2.00) and adds more only if needed (1 / 4 is 0.25). 1 / 3 never ends, so it
   * throws, and so does a zero divisor. The scale is only known at runtime.
   */
  div<T extends number>(other: DecimalOf<K, T>): DecimalOf<K, number>;
  /** this / an integer, with the same rules. Floats are not accepted. */
  div<const N extends IntLike>(other: IntArg<N>): DecimalOf<K, number>;

  /** the remainder of this / other, with the sign of this (like Rust's %). A zero divisor throws. */
  rem<T extends number>(other: DecimalOf<K, T>): DecimalOf<K, MaxScale<S, T>>;
  /** the remainder of this / an integer. Floats are not accepted. */
  rem<const N extends IntLike>(other: IntArg<N>): DecimalOf<K, S>;

  /** -this, with the same scale */
  neg(): DecimalOf<K, S>;

  /** true if the values are equal. The scale is ignored: 1.0 equals 1.00. */
  eq<T extends number>(other: DecimalOf<K, T>): boolean;
  /** true if this equals an integer. Floats are not accepted. */
  eq<const N extends IntLike>(other: IntArg<N>): boolean;
  ne(other: unknown): boolean;
}

/**
 * Exact decimal with up to 8 significant digits and 8 decimal places.
 *
 * @remarks `S` is the scale: `d32<2>` is like `1.50`.
 */
export interface d32<S extends number = number, P extends number = number> extends Prettify<
  Decimal<"d32", S, P>
> {}
/**
 * Exact decimal with up to 16 significant digits and 16 decimal places.
 *
 * @remarks `S` is the scale: `d64<2>` is like `1.50`.
 */
export interface d64<S extends number = number, P extends number = number> extends Prettify<
  Decimal<"d64", S, P>
> {}

/**
 * Exact decimal with up to 28 significant digits and 28 decimal places.
 *
 * @remarks `S` is the scale: `d128<2>` is like `1.50`.
 */
export interface d128<S extends number = number, P extends number = number> extends Prettify<
  Decimal<"d128", S, P>
> {}

// digits = significant digits, scale = digits after the point. Both limits apply on their
// own, and the scale cap equals the digit cap, the same relationship rust_decimal has
// (28 places, 28 digits). Leading zeros after the point are not significant, so
// "0.0000000000000000000000000001" is 1 digit with scale 28. d128 mirrors rust_decimal;
// the sizes of d32 and d64 are our own.
type Limits = { readonly digits: number; readonly scale: number };
const D32_LIMITS = { digits: 8, scale: 8 } as const;
const D64_LIMITS = { digits: 16, scale: 16 } as const;
const D128_LIMITS = { digits: 28, scale: 28 } as const;

// ------------------------------------------------------------------- types
// The literal is checked while compiling, the same way InRange checks integers.
// Number literals could not do this (1.0 and 1 are the same number), strings can.

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type AllDigits<S extends string> = S extends ""
  ? true
  : S extends `${Digit}${infer R}`
    ? AllDigits<R>
    : false;

type StripZeros<S extends string> = S extends `0${infer R}` ? StripZeros<R> : S;

type Tup<N extends number, A extends 0[] = []> = A["length"] extends N ? A : Tup<N, [...A, 0]>;

// S has at most N characters
type LenLte<S extends string, N extends number> =
  Tup<N> extends [...Chars<S>, ...unknown[]] ? true : false;

type Unsigned<S extends string> = S extends `-${infer B}` ? B : S;

// integer part: "0" or digits without a leading zero. fraction part: at least one digit.
type ShapeOk<I extends string, F extends string> = I extends ""
  ? false
  : F extends ""
    ? false
    : AllDigits<I> extends true
      ? AllDigits<F> extends true
        ? I extends "0"
          ? true
          : I extends `0${string}`
            ? false
            : true
        : false
      : false;

// integer-only literal: "0", or digits without a leading zero
type IntShapeOk<I extends string> = I extends ""
  ? false
  : AllDigits<I> extends true
    ? I extends "0"
      ? true
      : I extends `0${string}`
        ? false
        : true
    : false;

type BadFormat =
  'invalid decimal literal: use digits with an optional ".", like "2" or "1.50" (no exponent, no "+", no leading zeros)';

type TooManyPlaces = "too many decimal places for this decimal type";
type TooManyDigits = "too many significant digits for this decimal type";

/** S itself when it is a valid literal, otherwise an error message (which TS then shows). */
type DecimalArg<S extends string, L extends Limits> = string extends S
  ? S // not a literal: checked at runtime
  : Unsigned<S> extends `${infer I}.${infer F}`
    ? ShapeOk<I, F> extends true
      ? LenLte<F, L["scale"]> extends true
        ? LenLte<StripZeros<`${I}${F}`>, L["digits"]> extends true
          ? S
          : TooManyDigits
        : TooManyPlaces
      : BadFormat
    : IntShapeOk<Unsigned<S>> extends true
      ? LenLte<StripZeros<Unsigned<S>>, L["digits"]> extends true
        ? S
        : TooManyDigits
      : BadFormat;

/** the scale written in the literal: "0.10000" gives 5 */
type ScaleOf<S extends string> = string extends S
  ? number
  : S extends `${string}.${infer F}`
    ? Chars<F>["length"]
    : 0;

// ----------------------------------------------------------------- methods
// The scales of the arguments are literal numbers, so the result scale is computed while
// compiling. A scale that is not a literal (plain `number`) gives `number`.

/** the named type of a kind (d32<S>, d64<S> or d128<S>), so hovers and errors show it */
type DecimalOf<K extends DecimalKind, S extends number, P extends number = number> = K extends "d32"
  ? d32<S, P>
  : K extends "d64"
    ? d64<S, P>
    : d128<S, P>;

/** the significant digits written in the literal: "1.50" gives 3. Zero and non-literals give number (unknown). */
type DigitsOf<S extends string> = string extends S
  ? number
  : Unsigned<S> extends `${infer I}.${infer F}`
    ? StripZeros<`${I}${F}`> extends ""
      ? number
      : Chars<StripZeros<`${I}${F}`>>["length"]
    : StripZeros<Unsigned<S>> extends ""
      ? number
      : Chars<StripZeros<Unsigned<S>>>["length"];

type LimitsOf<K extends DecimalKind> = K extends "d32"
  ? typeof D32_LIMITS
  : K extends "d64"
    ? typeof D64_LIMITS
    : typeof D128_LIMITS;

type ResultTooManyDigits =
  "the result would have too many significant digits for this decimal type";

/** the fewest digits a product can have: an a-digit times a b-digit number has at least a + b - 1 */
type MulDigits<A extends number, B extends number> = number extends A
  ? number
  : number extends B
    ? number
    : [...Tup<A>, ...Tup<B>] extends [0, ...infer R]
      ? R["length"]
      : never;

type DigitsFit<N extends number, L extends Limits> = number extends N
  ? true
  : Tup<L["digits"]> extends [...Tup<N>, ...unknown[]]
    ? true
    : false;

type MulGuard<
  K extends DecimalKind,
  S extends number,
  T extends number,
  D extends number,
  Q extends number,
> =
  ScaleFits<SumScale<S, T>, LimitsOf<K>> extends true
    ? DigitsFit<MulDigits<D, Q>, LimitsOf<K>> extends true
      ? unknown
      : ResultTooManyDigits
    : ResultTooManyPlaces;

type IntLike = u8 | u16 | u32 | usize | u64 | u128 | i8 | i16 | i32 | isize | i64 | i128;

type FloatNotAllowed = "floats are not accepted: pass an integer or a decimal of the same kind";
type ResultTooManyPlaces = "the result would have too many decimal places for this decimal type";

/** N itself when it is an integer, otherwise an error message. Non-literals are checked at runtime. */
type IntArg<N extends IntLike> = N extends number
  ? number extends N
    ? N
    : `${N}` extends `${string}${"." | "e" | "E"}${string}`
      ? FloatNotAllowed
      : N
  : N;

type MaxScale<A extends number, B extends number> = number extends A
  ? number
  : number extends B
    ? number
    : Tup<A> extends [...Tup<B>, ...unknown[]]
      ? A
      : B;

type SumScale<A extends number, B extends number> = number extends A
  ? number
  : number extends B
    ? number
    : [...Tup<A>, ...Tup<B>] extends infer R extends unknown[]
      ? R["length"]
      : never;

// N is at most the scale limit
type ScaleFits<N extends number, L extends Limits> = number extends N
  ? true
  : Tup<L["scale"]> extends [...Tup<N>, ...unknown[]]
    ? true
    : false;

interface DecimalType<K> {
  /** true if the string is a valid literal for this type: format, digit and scale limits. */
  is(s: string): boolean;
  /** Ok(decimal) with the scale kept, or Err(why) if the string is not a valid literal. */
  try_from(s: string): Result<K, string>;
}

export interface D32 extends Prettify<DecimalType<d32>> {
  <const S extends string>(s: DecimalArg<S, typeof D32_LIMITS>): d32<ScaleOf<S>, DigitsOf<S>>;
}
export interface D64 extends Prettify<DecimalType<d64>> {
  <const S extends string>(s: DecimalArg<S, typeof D64_LIMITS>): d64<ScaleOf<S>, DigitsOf<S>>;
}
export interface D128 extends Prettify<DecimalType<d128>> {
  <const S extends string>(s: DecimalArg<S, typeof D128_LIMITS>): d128<ScaleOf<S>, DigitsOf<S>>;
}

// ----------------------------------------------------------------- runtime

const LIMITS: Record<DecimalKind, Limits> = {
  d32: D32_LIMITS,
  d64: D64_LIMITS,
  d128: D128_LIMITS,
};

const pow10 = (n: number): bigint => 10n ** BigInt(n);
const abs = (n: bigint): bigint => (n < 0n ? -n : n);

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** "-1.50" is mantissa -150n with scale 2 */
function format_decimal(mantissa: bigint, scale: number): string {
  const sign = mantissa < 0n ? "-" : "";
  const digits = abs(mantissa).toString();
  if (scale === 0) return sign + digits;
  const padded = digits.padStart(scale + 1, "0");
  const split = padded.length - scale;
  return `${sign}${padded.slice(0, split)}.${padded.slice(split)}`;
}

type Operand = { readonly mantissa: bigint; readonly scale: number };

// The method signatures are on the Decimal interface (they are too generic for the class
// to implement), so the class only promises the plain members. `make` does the cast.
class DecimalImpl<K extends DecimalKind, S extends number>
  extends impl(PartialEq<any>, Debug, Clone)
  implements Pick<Decimal<K, S>, "kind" | "scale" | "to_string" | "toJSON">
{
  /** the digits as a signed whole number: "-1.50" has mantissa -150n */
  readonly #mantissa: bigint;

  constructor(
    readonly kind: K,
    mantissa: bigint,
    readonly scale: S,
  ) {
    super();
    this.#mantissa = mantissa;
    Object.freeze(this);
  }

  to_string(): string {
    return format_decimal(this.#mantissa, this.scale);
  }

  toJSON(): string {
    return this.to_string();
  }

  /** other as a mantissa and a scale. Throws for another kind, a float, or anything else. */
  #try_operand(other: unknown): Result<Operand, string> {
    if (typeof other === "object" && other !== null && #mantissa in other) {
      if (other.kind !== this.kind) return Result.Err(`cannot mix ${this.kind} with ${other.kind}`);
      return Result.Ok({ mantissa: other.#mantissa, scale: other.scale });
    }
    if (typeof other === "bigint") return Result.Ok({ mantissa: other, scale: 0 });
    if (typeof other === "number") {
      if (!Number.isInteger(other))
        return Result.Err(
          `${this.kind} does not accept floats (${other}): pass an integer or another ${this.kind}`,
        );
      return Result.Ok({ mantissa: BigInt(other), scale: 0 });
    }
    return Result.Err(`expected a ${this.kind} or an integer, got ${typeof other}`);
  }

  #operand(other: unknown) {
    const operand_result = this.#try_operand(other);
    return match(operand_result, {
      Ok: (val) => val,
      Err(err) {
        throw new TypeError(err);
      },
    });
  }

  /** both mantissas rescaled to the larger of the two scales */
  #align(other: Operand): { a: bigint; b: bigint; scale: number } {
    const scale = Math.max(this.scale, other.scale);
    return {
      a: this.#mantissa * pow10(scale - this.scale),
      b: other.mantissa * pow10(scale - other.scale),
      scale,
    };
  }

  /** the result, if it fits the limits of this kind. Otherwise throws. */
  #fit(mantissa: bigint, scale: number): Decimal<K> {
    const limits = LIMITS[this.kind];
    if (scale > limits.scale)
      throw new RangeError(
        `result out of range for ${this.kind}: ${format_decimal(mantissa, scale)} (at most ${limits.scale} decimal places)`,
      );
    if (abs(mantissa).toString().length > limits.digits)
      throw new RangeError(
        `result out of range for ${this.kind}: ${format_decimal(mantissa, scale)} (at most ${limits.digits} significant digits)`,
      );
    return make<K, number>(this.kind, mantissa, scale);
  }

  add(other: unknown): Decimal<K> {
    const { a, b, scale } = this.#align(this.#operand(other));
    return this.#fit(a + b, scale);
  }

  sub(other: unknown): Decimal<K> {
    const { a, b, scale } = this.#align(this.#operand(other));
    return this.#fit(a - b, scale);
  }

  mul(other: unknown): Decimal<K> {
    const b = this.#operand(other);
    return this.#fit(this.#mantissa * b.mantissa, this.scale + b.scale);
  }

  div(other: unknown): Decimal<K> {
    const divisor = this.#operand(other);
    // (a / 10^sa) / (b / 10^sb) is num / den, both whole numbers
    const num = this.#mantissa * pow10(divisor.scale);
    const den = divisor.mantissa * pow10(this.scale);
    if (den === 0n) throw new RangeError("attempt to divide by zero");
    // num / den ends only if, once reduced, the denominator is 2^x * 5^y. It then needs
    // max(x, y) decimal places.
    let rest = abs(den) / gcd(abs(num), abs(den));
    let twos = 0;
    let fives = 0;
    while (rest % 2n === 0n) {
      rest /= 2n;
      twos++;
    }
    while (rest % 5n === 0n) {
      rest /= 5n;
      fives++;
    }
    if (rest !== 1n)
      throw new RangeError(
        `${this.kind} cannot divide ${this.to_string()} by ${format_decimal(divisor.mantissa, divisor.scale)} exactly: the result never ends`,
      );
    // keep the places the numbers already have: 6.00 / 3 is 2.00
    const scale = Math.max(twos, fives, this.scale - divisor.scale);
    return this.#fit((num * pow10(scale)) / den, scale);
  }

  // the sign follows this, like Rust's %
  rem(other: unknown): Decimal<K> {
    const { a, b, scale } = this.#align(this.#operand(other));
    if (b === 0n) throw new RangeError("attempt to calculate the remainder with a divisor of zero");
    return this.#fit(a % b, scale);
  }

  neg(): Decimal<K> {
    return make<K, number>(this.kind, -this.#mantissa, this.scale);
  }

  eq(other: unknown): boolean {
    const operand = this.#try_operand(other);
    const this_value = this;
    return match(operand, {
      Ok(operand) {
        const { a, b } = this_value.#align(operand);
        return a === b;
      },
      Err: () => false,
    });
  }

  ne(other: unknown): boolean {
    return !this.eq(other);
  }

  clone() {
    return new DecimalImpl(this.kind, this.#mantissa, this.scale);
  }

  // Only the "string" hint (template literals, String(x)) works. Everything else
  // (a + b, a < b, Number(a), a + "") throws, so a decimal never turns into a number
  // or gets glued onto a string by accident.
  [Symbol.toPrimitive](hint: string): string {
    if (hint === "string") return this.to_string();
    throw new TypeError(
      `a ${this.kind} cannot be used with operators or as a number; use its methods, or to_string()`,
    );
  }

  [FMT](): string {
    return `${this.kind}(${this.to_string()})`;
  }
}

function make<K extends DecimalKind, S extends number>(
  kind: K,
  mantissa: bigint,
  scale: S,
): Decimal<K, S> {
  return new DecimalImpl(kind, mantissa, scale) as unknown as Decimal<K, S>;
}

const LITERAL = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

function parse_decimal<K extends DecimalKind>(
  kind: K,
  limits: Limits,
  s: unknown,
): Result<Decimal<K>, string> {
  if (typeof s !== "string") return Result.Err(`expected a string for ${kind}, got ${typeof s}`);
  const match = LITERAL.exec(s);
  if (!match)
    return Result.Err(
      `invalid decimal literal for ${kind}: ${JSON.stringify(s)} (expected digits with an optional ".", like "2" or "1.50")`,
    );
  const [, sign, int] = match;
  const frac = match[3] ?? "";
  if (frac.length > limits.scale)
    return Result.Err(
      `literal out of range for ${kind}: ${s} (at most ${limits.scale} decimal places)`,
    );
  // leading zeros are not significant: "0.0012" has 2 digits. zero counts as 1.
  const digits = (int + frac).replace(/^0+/, "").length || 1;
  if (digits > limits.digits)
    return Result.Err(
      `literal out of range for ${kind}: ${s} (at most ${limits.digits} significant digits)`,
    );
  const magnitude = BigInt(int + frac);
  return Result.Ok<Decimal<K>, string>(
    make(kind, sign === "-" ? -magnitude : magnitude, frac.length),
  );
}

function decimal_type<K extends DecimalKind>(kind: K, limits: Limits) {
  const construct = (s: string): Decimal<K> => {
    const parsed = parse_decimal(kind, limits, s);
    return match(parsed, {
      Err(err) {
        throw new Error(err);
      },
      Ok(val) {
        return val;
      },
    });
  };
  return Object.assign(construct, {
    is: (s: string): boolean => parse_decimal(kind, limits, s).is_ok(),
    try_from: (s: string): Result<Decimal<K>, string> => parse_decimal(kind, limits, s),
  });
}

/**
 * Builds a `d32` from a string like `"1.50"`.
 *
 * @remarks Digits, with an optional . and more digits. No exponent. The scale is kept, so `"0.10000"` has 5 places.
 * @throws If the string is invalid or over the limits.
 * @example
 * ```ts
 * const price = d32("1.50");
 * ```
 */
export const d32 = decimal_type("d32", D32_LIMITS) as D32;
/**
 * Builds a `d64` from a string like `"1.50"`.
 *
 * @remarks Digits, with an optional . and more digits. No exponent. The scale is kept, so `"0.10000"` has 5 places.
 * @throws If the string is invalid or over the limits.
 * @example
 * ```ts
 * const price = d64("1.50");
 * ```
 */
export const d64 = decimal_type("d64", D64_LIMITS) as D64;
/**
 * Builds a `d128` from a string like `"1.50"`.
 *
 * @remarks Digits, with an optional . and more digits. No exponent. The scale is kept, so `"0.10000"` has 5 places.
 * @throws If the string is invalid or over the limits.
 * @example
 * ```ts
 * const price = d128("1.50");
 * ```
 */
export const d128 = decimal_type("d128", D128_LIMITS) as D128;

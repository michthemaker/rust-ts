import { Prettify } from "../lib/types";
import { Result } from "./result";

export type Int<K extends string> = number & { readonly __num?: K };
export type UInt<K extends string> = number & { readonly __num?: K };
export type BigInt_<K extends string> = bigint & { readonly __num?: K };
export type BigUInt_<K extends string> = bigint & { readonly __num?: K };
export type Float<K extends string> = number & { readonly __num?: K };

// digit arithmetic
// Compares decimal strings, so the cost is the number of digits (at most 39
// for u128), not the number of legal values.

type Chars<S extends string, A extends 0[] = []> = S extends `${string}${infer R}`
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

interface U8 extends Prettify<UIntType<u8>> {
  <const N extends number>(n: InRange<N, "0", "255">): u8;
}
interface U16 extends Prettify<UIntType<u16>> {
  <const N extends number>(n: InRange<N, "0", "65535">): u16;
}
interface U32 extends Prettify<UIntType<u32>> {
  <const N extends number>(n: InRange<N, "0", "4294967295">): u32;
}
interface USize extends Prettify<UIntType<usize>> {
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
interface U64 extends Prettify<BigUIntType<u64>> {
  <const N extends bigint>(n: InRange<N, "0", "18446744073709551615">): u64;
}
interface U128 extends Prettify<BigUIntType<u128>> {
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

interface I8 extends Prettify<IntType<i8>> {
  <const N extends number>(n: InRange<N, "128", "127">): i8;
}
interface I16 extends Prettify<IntType<i16>> {
  <const N extends number>(n: InRange<N, "32768", "32767">): i16;
}
interface I32 extends Prettify<IntType<i32>> {
  <const N extends number>(n: InRange<N, "2147483648", "2147483647">): i32;
}
interface ISize extends Prettify<IntType<isize>> {
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
interface I64 extends Prettify<BigIntType<i64>> {
  <const N extends bigint>(n: InRange<N, "9223372036854775808", "9223372036854775807">): i64;
}
interface I128 extends Prettify<BigIntType<i128>> {
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
  /** true for any number whose rounded value does not overflow. NaN and +-Infinity are valid floats. */
  is(n: number): n is F;
  /** Ok(rounded value), or Err if a finite number overflows this type. */
  try_from(n: number): Result<F, string>;
}

interface F32 extends Prettify<FloatType<f32>> {
  <const N extends number>(n: number extends N ? N : F32Ok<N> extends true ? N : never): f32;
}
interface F64 extends Prettify<FloatType<f64>> {
  <const N extends number>(n: N): f64;
}

function float_type<F extends number>(
  limits: { max: number; min_positive: number; epsilon: number },
  round: (n: number) => number, // Math.fround for f32, identity for f64
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
      return is(n)
        ? Result.Ok(round(n) as F)
        : Result.Err("out of range floating point conversion attempted");
    },
  };
}

export const f32: F32 = object_assign(
  (n: number): f32 => {
    if (!(typeof n === "number" && (!Number.isFinite(n) || Number.isFinite(Math.fround(n)))))
      throw new Error(`literal out of range for f32: ${n}`);
    return Math.fround(n) as f32;
  },
  float_type<f32>(
    {
      max: 3.4028234663852886e38,
      min_positive: 1.1754943508222875e-38,
      epsilon: 1.1920928955078125e-7,
    },
    Math.fround,
  ),
);

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

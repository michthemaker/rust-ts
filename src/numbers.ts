// =====================================================================
// Sized numbers, type level only.
// Literals are range-checked at compile time (`u8(256)` is an error),
// plain `number` / `bigint` values pass the type check (runtime's job).
// Function bodies come later: everything below is `declare`.
// =====================================================================

// ---------------------------------------------------------------- tags
// Weak tags: plain numbers and literals flow in freely, but a u8 will not
// silently pass as a u16 (or as an f32).

// All three share ONE property name, so two different tags always conflict
// (u8 vs u16, u8 vs f32, u64 vs u128 are all errors).
export type Int<K extends string> = number & { readonly __num?: K };
export type BigInt_<K extends string> = bigint & { readonly __num?: K };
export type Float<K extends string> = number & { readonly __num?: K };

// ------------------------------------------------------- digit arithmetic
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

export type u8 = Int<"u8">;
export type u16 = Int<"u16">;
export type u32 = Int<"u32">;
export type u64 = BigInt_<"u64">;
export type u128 = BigInt_<"u128">;
export type usize = Int<"usize">; // 32-bit: JS array indices stop at 2^32 - 1

export declare const u8: <const N extends number>(n: InRange<N, "0", "255">) => u8;
export declare const u16: <const N extends number>(n: InRange<N, "0", "65535">) => u16;
export declare const u32: <const N extends number>(n: InRange<N, "0", "4294967295">) => u32;
export declare const u64: <const N extends bigint>(
  n: InRange<N, "0", "18446744073709551615">,
) => u64;
export declare const u128: <const N extends bigint>(
  n: InRange<N, "0", "340282366920938463463374607431768211455">,
) => u128;
export declare const usize: <const N extends number>(n: InRange<N, "0", "4294967295">) => usize;

// ------------------------------------------------------------------- signed
// MinMag is the magnitude of the minimum (i8: -128 -> "128").

export type i8 = Int<"i8">;
export type i16 = Int<"i16">;
export type i32 = Int<"i32">;
export type i64 = BigInt_<"i64">;
export type i128 = BigInt_<"i128">;
export type isize = Int<"isize">; // 32-bit, like usize

export declare const i8: <const N extends number>(n: InRange<N, "128", "127">) => i8;
export declare const i16: <const N extends number>(n: InRange<N, "32768", "32767">) => i16;
export declare const i32: <const N extends number>(
  n: InRange<N, "2147483648", "2147483647">,
) => i32;
export declare const i64: <const N extends bigint>(
  n: InRange<N, "9223372036854775808", "9223372036854775807">,
) => i64;
export declare const i128: <const N extends bigint>(
  n: InRange<
    N,
    "170141183460469231731687303715884105728",
    "170141183460469231731687303715884105727"
  >,
) => i128;
export declare const isize: <const N extends number>(
  n: InRange<N, "2147483648", "2147483647">,
) => isize;

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

export declare const f32: <const N extends number>(
  n: number extends N ? N : F32Ok<N> extends true ? N : never,
) => f32;
export declare const f64: <const N extends number>(n: N) => f64;

import { pick } from "../lib/pick";
import * as SizedNumbers from "./numbers";

declare global {
  // number types
  // uint
  type u8 = SizedNumbers.u8;
  type u16 = SizedNumbers.u16;
  type u32 = SizedNumbers.u32;
  type usize = SizedNumbers.usize;
  type u64 = SizedNumbers.u64;
  type u128 = SizedNumbers.u128;

  // int
  type i8 = SizedNumbers.i8;
  type i16 = SizedNumbers.i16;
  type i32 = SizedNumbers.i32;
  type isize = SizedNumbers.isize;
  type i64 = SizedNumbers.i64;
  type i128 = SizedNumbers.i128;

  // float
  type f32 = SizedNumbers.f32;
  type f64 = SizedNumbers.f64;

  /**
   * Exact decimal with up to 8 significant digits and 8 decimal places.
   *
   * @remarks `S` is the scale: `d32<2>` is like `1.50`.
   */
  type d32<S extends number = number, P extends number = number> = SizedNumbers.d32<S, P>; /**
   * Exact decimal with up to 16 significant digits and 16 decimal places.
   *
   * @remarks `S` is the scale: `d64<2>` is like `1.50`.
   */
  type d64<S extends number = number, P extends number = number> = SizedNumbers.d64<S, P>; /**
   * Exact decimal with up to 28 significant digits and 28 decimal places.
   *
   * @remarks `S` is the scale: `d128<2>` is like `1.50`.
   */
  type d128<S extends number = number, P extends number = number> = SizedNumbers.d128<S, P>;
  // uint
  const u8: SizedNumbers.U8;
  const u16: SizedNumbers.U16;
  const u32: SizedNumbers.U32;
  const usize: SizedNumbers.USize;
  const u64: SizedNumbers.U64;
  const u128: SizedNumbers.U128;

  // int
  const i8: SizedNumbers.I8;
  const i16: SizedNumbers.I16;
  const i32: SizedNumbers.I32;
  const isize: SizedNumbers.ISize;
  const i64: SizedNumbers.I64;
  const i128: SizedNumbers.I128;

  // float
  const f32: SizedNumbers.F32;
  const f64: SizedNumbers.F64;

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
  const d32: SizedNumbers.D32;
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
  const d64: SizedNumbers.D64;
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
  const d128: SizedNumbers.D128;
}

Object.assign(
  globalThis,
  pick(
    SizedNumbers,
    "u8",
    "u16",
    "u32",
    "usize",
    "u64",
    "u128",
    "i8",
    "i16",
    "i32",
    "isize",
    "i64",
    "i128",
    "f32",
    "f64",
    "d32",
    "d64",
    "d128",
  ),
);

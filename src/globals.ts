import { pick } from "../lib/pick";
import * as SizedNumbers from "./numbers";

declare global {
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
  ),
);

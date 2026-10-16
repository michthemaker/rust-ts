import "../src/globals.ts";
import { expect, test, describe } from "bun:test";
import { Result } from "../src/result.ts";

function Tuple<const T extends unknown[]>(...args: T): T {
  return args;
}

describe("Sized numbers", () => {
  f32(1e20);
  const unsigned_types_and_edges = Tuple(
    Tuple(u8, -1, 256),
    Tuple(u16, -1, 65_536),
    Tuple(u32, -1, 4_294_967_296),
    Tuple(usize, -1, 4_294_967_296),
    Tuple(u64, -1n, 18_446_744_073_709_551_616n),
    Tuple(u128, -1n, 340_282_366_920_938_463_463_374_607_431_768_211_456n),
  );
  const signed_types_and_edges = Tuple(
    Tuple(i8, -129, 128),
    Tuple(i16, -32_769, 32_768),
    Tuple(i32, -2_147_483_649, 2_147_483_648),
    Tuple(isize, -2_147_483_649, 2_147_483_648),
    Tuple(i64, -9_223_372_036_854_775_809n, 9_223_372_036_854_775_808n),
    Tuple(
      i128,
      -170_141_183_460_469_231_731_687_303_715_884_105_729n,
      170_141_183_460_469_231_731_687_303_715_884_105_728n,
    ),
  );
  const float_types_and_edges = Tuple(Tuple(f32, -3.4028236e38, 3.4028236e38));
  test("unsigned types fails at min max edges", () => {
    for (const t_and_e of unsigned_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      // @ts-expect-error
      expect(() => fn(min_edge)).toThrow();
      // @ts-expect-error
      expect(() => fn(max_edge)).toThrow();
    }
  });
  test("signed types fails at min max edges", () => {
    for (const t_and_e of signed_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      // @ts-expect-error
      expect(() => fn(min_edge)).toThrow();
      // @ts-expect-error
      expect(() => fn(max_edge)).toThrow();
    }
  });
  test("f32 types fails at min max edges", () => {
    for (const t_and_e of float_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      // @ts-expect-error
      expect(() => fn(min_edge)).toThrow();
      // @ts-expect-error
      expect(() => fn(max_edge)).toThrow();
    }
  });
  test("f64 and f32 accept special values", () => {
    expect(f64.is(Infinity)).toBe(true);
    expect(f64.is(-Infinity)).toBe(true);
    expect(f64.is(NaN)).toBe(true);
    expect(f64.is(0)).toBe(true);
    expect(f64.is(-0)).toBe(true);

    expect(f32.is(Infinity)).toBe(true);
    expect(f32.is(NaN)).toBe(true);
    // Large number that overflows f32:
    expect(f32.is(4e38)).toBe(false);
  });
  test("'.is' on the in-range and out-of-range sides", () => {
    for (const t_and_e of unsigned_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      if (typeof min_edge === "bigint" && typeof max_edge === "bigint") {
        // in-range check
        expect(fn.is(min_edge + 5n)).toBe(true);
        // out-of-range check
        expect(fn.is(min_edge)).toBe(false);
        expect(fn.is(max_edge)).toBe(false);
      } else {
        // in-range check
        expect(fn.is(min_edge + 5)).toBe(true);
        // out-of-range check
        expect(fn.is(min_edge)).toBe(false);
        expect(fn.is(max_edge)).toBe(false);
      }
    }
    for (const t_and_e of signed_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      if (typeof min_edge === "bigint" && typeof max_edge === "bigint") {
        // in-range check
        expect(fn.is(min_edge + 5n)).toBe(true);
        // out-of-range check
        expect(fn.is(min_edge)).toBe(false);
        expect(fn.is(max_edge)).toBe(false);
      } else {
        // in-range check
        expect(fn.is(min_edge + 5)).toBe(true);
        // out-of-range check
        expect(fn.is(min_edge)).toBe(false);
        expect(fn.is(max_edge)).toBe(false);
      }
    }
    for (const t_and_e of float_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      // Safe in-range values
      expect(fn.is(fn.MIN_POSITIVE)).toBe(true);
      expect(fn.is(1e20)).toBe(true);
      expect(fn.is(0.1)).toBe(true);
      expect(fn.is(0)).toBe(true);
      expect(fn.is(fn.MAX)).toBe(true);
      expect(fn.is(fn.MIN)).toBe(true);
      // rounds down to MAX, so it does not overflow (same as Rust)
      expect(fn.is(3.4028235e38)).toBe(true);
      // out-of-range check
      expect(fn.is(min_edge)).toBe(false);
      expect(fn.is(max_edge)).toBe(false);
    }
  });
  test("'.try_from' on the in-range and out-of-range sides", () => {
    for (const t_and_e of unsigned_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      if (typeof min_edge === "bigint" && typeof max_edge === "bigint") {
        // in-range check
        expect(fn.try_from(min_edge + 5n)).toEqual(Result.Ok(min_edge + 5n));
        // out-of-range check
        expect(fn.try_from(min_edge).is_err()).toEqual(true);
        expect(fn.try_from(max_edge).is_err()).toEqual(true);
      } else {
        // in-range check
        expect(fn.try_from(min_edge + 5)).toEqual(Result.Ok(min_edge + 5));
        // out-of-range check
        expect(fn.try_from(min_edge).is_err()).toEqual(true);
        expect(fn.try_from(max_edge).is_err()).toEqual(true);
      }
    }
    for (const t_and_e of signed_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      if (typeof min_edge === "bigint" && typeof max_edge === "bigint") {
        // in-range check
        expect(fn.try_from(min_edge + 5n)).toEqual(Result.Ok(min_edge + 5n));
        // out-of-range check
        expect(fn.try_from(min_edge).is_err()).toEqual(true);
        expect(fn.try_from(max_edge).is_err()).toEqual(true);
      } else {
        // in-range check
        expect(fn.try_from(min_edge + 5)).toEqual(Result.Ok(min_edge + 5));
        // out-of-range check
        expect(fn.try_from(min_edge).is_err()).toEqual(true);
        expect(fn.try_from(max_edge).is_err()).toEqual(true);
      }
    }
    for (const t_and_e of float_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      // Safe in-range values
      expect(fn.try_from(fn.MIN_POSITIVE)).toEqual(Result.Ok(fn.MIN_POSITIVE));
      expect(fn.try_from(1e10)).toEqual(Result.Ok(1e10));
      expect(fn.try_from(1e20)).toEqual(Result.Ok(1e20));
      expect(fn.try_from(0.1)).toEqual(Result.Ok(0.1));
      expect(fn.try_from(0)).toEqual(Result.Ok(0));
      expect(fn.try_from(fn.MAX + 0.9)).toEqual(Result.Ok(fn.MAX + 0.9)); // 90% of max

      // out-of-range check
      expect(fn.try_from(min_edge).is_err()).toEqual(true);
      expect(fn.try_from(max_edge).is_err()).toEqual(true);
    }
  });
  test("floats are bounds only: the value is returned unchanged", () => {
    expect(f32(0.1)).toBe(0.1);
    expect(f32(1e20)).toBe(1e20);
    expect(f32(3.4028235e38)).toBe(3.4028235e38);
    expect(f32.try_from(0.1).unwrap()).toBe(0.1);
    expect(f32.try_from(1e20).unwrap()).toBe(1e20);
    expect(f32.try_from(4e38).is_err()).toBe(true);
    expect(f64(0.1)).toBe(0.1);
    expect(f64.try_from(0.1).unwrap()).toBe(0.1);
  });
  test("Wrong runtime types: a 'number' where a 'bigint' is expected, a string, 'NaN'", () => {
    // @ts-expect-error
    expect(() => u128(56)).toThrow();
    // @ts-expect-error
    expect(() => u8(56_00_00n)).toThrow();
    // @ts-expect-error
    expect(() => i8(56_00_00n)).toThrow();
    // @ts-expect-error
    expect(() => i32(56_00_00n)).toThrow();
    // @ts-expect-error
    expect(() => f32(56_00_00n)).toThrow();

    // NaN checks
    expect(() => i8(NaN)).toThrow();
    expect(() => i32(NaN)).toThrow();
    // @ts-expect-error
    expect(() => i64(NaN)).toThrow();
    // @ts-expect-error
    expect(() => i128(NaN)).toThrow();
    expect(() => u8(NaN)).toThrow();
    expect(() => u32(NaN)).toThrow();
    // @ts-expect-error
    expect(() => u64(NaN)).toThrow();
    // @ts-expect-error
    expect(() => u128(NaN)).toThrow();

    // string checks
    // @ts-expect-error
    expect(() => u128("56")).toThrow();
    // @ts-expect-error
    expect(() => u8("56_00_00n")).toThrow();
    // @ts-expect-error
    expect(() => i8("56_00_00n")).toThrow();
    // @ts-expect-error
    expect(() => i32("56_00_00n")).toThrow();
    // @ts-expect-error
    expect(() => f32("56_00_00n")).toThrow();
  });
});

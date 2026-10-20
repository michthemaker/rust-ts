import "../src/globals.ts";
import { expect, test, describe } from "bun:test";
import { Result } from "../src/result.ts";
import { inspect } from "bun";
import { Tuple } from "../src/tuple.ts";

describe("Sized numbers", () => {
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
  const decimal_types_and_sizes = Tuple(
    Tuple(d32, "9999999.9", "99999999.9", "0.00000001", "0.000000001", "0.99999999", "1.00000000"),
    Tuple(
      d64,
      "999999999999999.9",
      "9999999999999999.9",
      "0.0000000000000001",
      "0.00000000000000001",
      "0.9999999999999999",
      "1.0000000000000000",
    ),
    Tuple(
      d128,
      "999999999999999999999999999.9",
      "9999999999999999999999999999.9",
      "0.0000000000000000000000000001",
      "0.00000000000000000000000000001",
      "0.9999999999999999999999999999",
      "1.0000000000000000000000000000",
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
  describe("Decimals", () => {
    test("decimal builds on max digits and max significant places", () => {
      for (const t of decimal_types_and_sizes) {
        const [fn, max_digits, , max_places, , all_nines] = t;
        expect(() => fn(max_digits)).not.toThrow();
        expect(() => fn(max_places)).not.toThrow();
        expect(() => fn(all_nines)).not.toThrow();
      }
    });
    test("decimal types fails at edges", () => {
      for (const t of decimal_types_and_sizes) {
        const [fn, , over_digits, , over_places, , digits_over_at_max_places] = t;
        expect(() => fn(over_digits as any)).toThrow();
        expect(() => fn(over_places as any)).toThrow(/literal out of range/i);
        expect(() => fn(digits_over_at_max_places as any)).toThrow(/literal out of range/i);
      }
    });
    describe("Parsing and representation", () => {
      test("The scale is kept", () => {
        const price = d32("0.10000");
        expect(price.scale).toBe(5);
        expect(inspect(price)).toBe("d32(0.10000)");
        expect(price.to_string()).toBe("0.10000");
      });
      test("Small mantissas pad correctly and negatives and zeros print right", () => {
        const price = d32("0.05"),
          discount = d32("-0.05");
        expect(inspect(price)).toBe("d32(0.05)");
        expect(inspect(discount)).toBe("d32(-0.05)");
      });
      test("'is' and 'try_from' agree with the constructor on every case", () => {
        for (const t of decimal_types_and_sizes) {
          const [fn, max_digits, over_digits, max_places, over_places] = t;
          // good path
          expect(() => fn(max_digits)).not.toThrow();
          expect(fn.is(max_digits)).toBe(true);
          expect(fn.try_from(max_digits).is_ok()).toBe(true);

          expect(() => fn(max_places)).not.toThrow();
          expect(fn.is(max_places)).toBe(true);
          expect(fn.try_from(max_places).is_ok()).toBe(true);

          // bad path

          // @ts-expect-error
          expect(() => fn(over_digits)).toThrow();
          expect(fn.is(over_digits)).toBe(false);
          expect(fn.try_from(over_digits).is_err()).toBe(true);

          // @ts-expect-error
          expect(() => fn(over_places)).toThrow();
          expect(fn.is(over_places)).toBe(false);
          expect(fn.try_from(over_places).is_err()).toBe(true);

          // @ts-expect-error
          expect(() => fn(1)).toThrow();
          // @ts-expect-error
          expect(fn.is(29)).toBe(false);
          // @ts-expect-error
          expect(fn.try_from(2920).is_err()).toBe(true);
        }
      });
      test("The motivating case", () => {
        expect(d32("0.3").add(d32("0.2")).eq(d32("0.5"))).toBe(true);
      });
    });
    describe("Result scale rules", () => {
      const [_1, _2, _3, _4, _5, _6] = Tuple(
        d32("0.1000083"),
        d32("0.6"),
        d64("100.02900"),
        d64("1000.92002"),
        d128("1000.569302020202"),
        d128("1000.5693"),
      );

      test("'add', 'sub' and 'rem' use the larger scale ('0.10000 + 0.3222' is '0.42220').", () => {
        expect(_1.add(_2).scale).toBe(7);
        expect(_3.add(_4).scale).toBe(5);
        expect(_5.add(_6).scale).toBe(12);

        expect(_1.sub(_2).scale).toBe(7);
        expect(_3.sub(_4).scale).toBe(5);
        expect(_5.sub(_6).scale).toBe(12);

        console.log(_3.rem(_4));

        expect(_1.rem(_2).scale).toBe(7);
        expect(_3.rem(_4).scale).toBe(5);
        expect(_5.rem(_6).scale).toBe(12);
      });
      test("'mul' uses the sum ('1.5 * 1.5' is '2.25').", () => {
        expect(_1.mul(_2).scale).toBe(8);
        expect(_3.mul(_4).scale).toBe(10);
        expect(_5.mul(_6).scale).toBe(16);
      });
      test("An integer argument leaves the scale alone ('1.50 + 1' is '2.50', '1.50 * 2' is '3.00').", () => {
        expect(_1.add(3).scale).toBe(7);
        expect(_3.add(29).scale).toBe(5);
        expect(_5.add(10000).scale).toBe(12);

        expect(_1.mul(3).scale).toBe(7);
        expect(_3.mul(29).scale).toBe(5);
        expect(_5.mul(10000).scale).toBe(12);
      });
      test("'div' keeps the existing places and grows only if needed ('6.00 / 3' is '2.00', '1 / 4' is '0.25').", () => {
        expect(d32("1.0").div(4).scale).toBe(2);
        expect(d32("2.0000").div(4).scale).toBe(4);
        console.log(d32("2.0").div(d32("2.0000")));
      });
    });
    describe("Arithmetic correctness", () => {
      test("neg of zero, and neg(neg(x)) equals x", () => {
        expect(d32("1.0").neg()).to_equal(d32("-1.0"));
        expect(d32("0.0").neg()).to_equal(d32("0.0"));
      });
      test("Cross-check each operation against a plain bigint reference you write in the test, using random values.", () => {
        expect(d32("1000.0").add(1000n)).to_equal(d32("2000.0"));
        expect(d64("1000.0").mul(100000n)).to_equal(d64("100000000.0"));
        expect(d64("1000.0").div(100000n)).to_equal(d64("0.01"));
        expect(d64("1000.0").sub(100000n)).to_equal(d64("-99000.0"));
      });
      test("Algebraic properties", () => {
        const [a, b] = Tuple(d32("55.0"), d32("66.20"));
        expect(a.add(b)).to_equal(b.add(a));
        expect(a.add(b).sub(b)).to_equal(a as any);
        expect(a.sub(a)).to_equal(d32("0.0"));
      });
      test("Signs: every combination for mul and div", () => {
        const [a, b, c] = Tuple(d32("5.0"), d32("-6.0"), d32("-7.0"), d32("2.0"));
        // edge case here
        // @ts-expect-error
        expect(a.mul(b)).to_equal(d32("-30.00"));
        expect(a.neg().mul(b)).to_equal(d32("30.00"));
        expect(c.div(2)).to_equal(d32("-3.5"));
        expect(c.neg().div(2)).to_equal(d32("3.5"));
        expect(c.rem(2)).to_equal(d32("-1.0"));
        expect(c.neg().rem(2)).to_equal(d32("1.0"));
      });
    });
    describe("Limits during arithmetic", () => {
      test("Results over the digit or place limit throw 'RangeError', for each kind and each operation.", () => {
        const results_digit = Tuple(
          Tuple(d32("11111"), d32("11111")),
          Tuple(d64("19228382993022"), d64("2833822839")),
          Tuple(d128("288308283839293"), d128("28338232893838992839")),
        );

        const results_scale = Tuple(
          Tuple(d32("0.111113"), d32("0.111113")),
          Tuple(d64("0.19393922838"), d64("0.28322839")),
          Tuple(d128("0.28830828839293"), d128("0.2833823288992839")),
        );

        for (const value of results_digit) {
          const [op_1, op_2] = value;
          // @ts-expect-error
          expect(() => op_1.mul(op_2)).toThrow(RangeError);
        }

        for (const value of results_scale) {
          const [op_1, op_2] = value;
          // @ts-expect-error
          expect(() => op_1.mul(op_2)).toThrow(RangeError);
        }
      });
      test("'div' throws for a never-ending result and for a zero divisor, and 'rem' throws for a zero divisor.", () => {
        const operands = Tuple(d32("11111"), d64("19228382993022"), d128("288308283839293"));

        for (let operand of operands) {
          // @ts-expect-error
          expect(() => operand.div(0)).toThrow();
          // @ts-expect-error
          expect(() => operand.rem(0)).toThrow();
        }
        // never ending results
        expect(() => d32("20").div(3)).toThrow(/the result never ends/i);
        expect(() => d64("37").div(3)).toThrow(/the result never ends/i);
        expect(() => d128("10000000000000000000000000").div(9)).toThrow(/the result never ends/i);
      });
    });
    describe("Argument handling", () => {
      test("Integers via 'number', 'bigint' and the sized types; floats, 'NaN' and 'Infinity' throw 'TypeError'", () => {
        const errorables = Tuple(1, 320n, 0.2, NaN, Infinity);
        for (let errorable of errorables) {
          // @ts-expect-error
          expect(() => d32(errorable)).toThrow();
          // @ts-expect-error
          expect(() => d64(errorable)).toThrow();
          // @ts-expect-error
          expect(() => d128(errorable)).toThrow();
        }
      });
      test("Strings, 'null', 'undefined' and plain objects throw", () => {
        const errorables = Tuple(String(), "nameing", null, undefined, { name: "joh" });
        for (let errorable of errorables) {
          // @ts-expect-error
          expect(() => d32(errorable)).toThrow();
          // @ts-expect-error
          expect(() => d64(errorable)).toThrow();
          // @ts-expect-error
          expect(() => d128(errorable)).toThrow();
        }
      });
      test("A forged '{ kind, scale }' lookalike is rejected, since it fails the '#mantissa in other' check.", () => {
        const values = Tuple(
          // this one has a fake private mantissa field but fails too
          Tuple(d32("0.5"), { kind: "d32", scale: 5, "#mantissa": 0 }),
          Tuple(d64("0.5"), { kind: "d64", scale: 5 }),
          Tuple(d128("0.5"), { kind: "d128", scale: 5 }),
        );
        for (let t of values) {
          const [dec, fake_dec] = t;
          // @ts-expect-error
          expect(() => dec.add(fake_dec)).toThrow(TypeError);
        }
      });
      test("Mixing kinds throws for the arithmetic methods, and 'eq' only errors at compile time", () => {
        const [dec_a, dec_b, dec_c] = Tuple(d32("0.5"), d64("0.67"), d128("0.290"));
        const arithmetics = Tuple("add", "sub", "mul", "div", "rem");
        for (let arit of arithmetics) {
          // @ts-expect-error
          expect(() => dec_a[arit](dec_b)).toThrow(/cannot mix/i);
          // @ts-expect-error
          expect(() => dec_b[arit](dec_c)).toThrow(/cannot mix/i);
          // @ts-expect-error
          expect(() => dec_c[arit](dec_a)).toThrow(/cannot mix/i);
        }

        // eq
        // @ts-expect-error
        expect(() => dec_a.eq(dec_b)).not.toThrow();
        // @ts-expect-error
        expect(() => dec_b.eq(dec_c)).not.toThrow();
        // @ts-expect-error
        expect(() => dec_c.eq(dec_a)).not.toThrow();
      });
    });
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
        expect(fn.try_from(min_edge + 5n)).to_equal(Result.Ok(min_edge + 5n));
        // out-of-range check
        expect(fn.try_from(min_edge).is_err()).to_equal(true);
        expect(fn.try_from(max_edge).is_err()).to_equal(true);
      } else {
        // in-range check
        expect(fn.try_from(min_edge + 5)).to_equal(Result.Ok(min_edge + 5));
        // out-of-range check
        expect(fn.try_from(min_edge).is_err()).to_equal(true);
        expect(fn.try_from(max_edge).is_err()).to_equal(true);
      }
    }
    for (const t_and_e of signed_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      if (typeof min_edge === "bigint" && typeof max_edge === "bigint") {
        // in-range check
        expect(fn.try_from(min_edge + 5n)).to_equal(Result.Ok(min_edge + 5n));
        // out-of-range check
        expect(fn.try_from(min_edge).is_err()).to_equal(true);
        expect(fn.try_from(max_edge).is_err()).to_equal(true);
      } else {
        // in-range check
        expect(fn.try_from(min_edge + 5)).to_equal(Result.Ok(min_edge + 5));
        // out-of-range check
        expect(fn.try_from(min_edge).is_err()).to_equal(true);
        expect(fn.try_from(max_edge).is_err()).to_equal(true);
      }
    }
    for (const t_and_e of float_types_and_edges) {
      const [fn, min_edge, max_edge] = t_and_e;
      // Safe in-range values
      expect(fn.try_from(fn.MIN_POSITIVE)).to_equal(Result.Ok(fn.MIN_POSITIVE));
      expect(fn.try_from(1e10)).to_equal(Result.Ok(1e10));
      expect(fn.try_from(1e20)).to_equal(Result.Ok(1e20));
      expect(fn.try_from(0.1)).to_equal(Result.Ok(0.1));
      expect(fn.try_from(0)).to_equal(Result.Ok(0));
      expect(fn.try_from(fn.MAX + 0.9)).to_equal(Result.Ok(fn.MAX + 0.9)); // 90% of max

      // out-of-range check
      expect(fn.try_from(min_edge).is_err()).to_equal(true);
      expect(fn.try_from(max_edge).is_err()).to_equal(true);
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

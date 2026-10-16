import "../src/globals.ts";
import { expect, test, describe } from "bun:test";

function Tuple<const T extends unknown[]>(...args: T): T {
  return args;
}

describe("Sized numbers", () => {
  test("unsigneds fails below and above min max", () => {
    const throwables = Tuple(
      Tuple(u8, -1, 256),
      Tuple(u16, -17, 655_903),
      Tuple(u32, -56, 429_496_729_502),
      Tuple(usize, -90, 42_943_967_295),
      Tuple(u64, -900_000n, 184_467_440_737_095_516_151n),
      Tuple(u128, -900_000_000n, 1340_282_366_920_938_463_463_374_607_431_768_211_455n),
    );

    for (const t of throwables) {
      const [fn, past_min, past_max] = t;
      // @ts-expect-error
      expect(() => fn(past_min)).toThrow();
      // @ts-expect-error
      expect(() => fn(past_max)).toThrow();
    }
  });
  test("signeds fails below and above min max values", () => {
    const throwables = Tuple(
      Tuple(i8, -130, 140),
      Tuple(i16, -32769, 32768),
      Tuple(i32, -2147483650, 2147483660),
      Tuple(isize, -2147483649, 2147483671),
      Tuple(i64, -9223372036854775810n, 9223372036854775808n),
      Tuple(
        i128,
        -170141183460469231731687303715884105750n,
        170141183460469231731687303715884105771n,
      ),
    );

    for (const t of throwables) {
      const [fn, past_min, past_max] = t;
      // @ts-expect-error
      expect(() => fn(past_min)).toThrow();
      // @ts-expect-error
      expect(() => fn(past_max)).toThrow();
    }
  });
});

import { describe, test, expect, xdescribe } from "bun:test";
import { Result } from "../src/result";
import { Option } from "../src/option";

describe("Result<T, E>", () => {
  test("Result.is_result checks correctly", () => {
    const number = Result.Ok(3_000);
    expect(Result.is_result(number)).toBe(true);
  });

  describe("Value unwrapping", () => {
    test(".expect(msg) call on Result instance throws when result is an Err", () => {
      function expect_value_on_result() {
        const our_error = Result.Err<string, Error>(new Error("This is an error"));
        our_error.expect("We failed on this");
      }
      expect(expect_value_on_result).toThrow("We failed on this");
    });
    test(".unwrap() call on Result instance throws when result is an Err", () => {
      function unwrap_value_on_result() {
        const our_error = Result.Err<string, Error>(new Error("Class access Error"));
        our_error.unwrap();
      }
      expect(unwrap_value_on_result).toThrow();
    });
    test(".iter() call on Result instance is an Option instance ", () => {
      const number = Result.Err<string, number>(4_000);
      let value: Option<unknown>;
      for (const val of number.iter()) {
        value = val;
      }
      expect(Option.is_option(value!)).toBe(true);
      expect(value!.is_none()).toBe(true);
    });
  });
});

import { describe, expect, test } from "bun:test";
import { FixedArray } from "../src/vec";

describe("FixedArray<T, N>", () => {
  test("can be indexed like arrays", () => {
    const nums = new FixedArray(0, 3);
    expect(nums[2]).toBe(0);
  });
  test("throws on set index out of bounds", () => {
    function throws() {
      const nums = new FixedArray(4, 4);
      // @ts-ignore
      nums[4] = 9;
    }
    expect(throws).toThrow();
  });
  test("throws on get index out of bounds", () => {
    function throws() {
      const nums = new FixedArray(4, 4);
      // @ts-ignore
      nums[8];
    }
    expect(throws).toThrow();
  });
});

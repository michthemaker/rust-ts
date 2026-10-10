import { FixedArray } from "../src/fixed_array";
import { describe, test, expect } from "bun:test";
import { match, P } from "../src/match";

describe("FixedArray<T, N>", () => {
  test(".from_fn allocates array of size", () => {
    const my_arrs = FixedArray.from_fn(5, (i) => ({ name: "John", job_index: i * 3 }));
    const matched = match(my_arrs.get(2), {
      [P.Some({ name: "John", job_index: 6 })](v) {
        return v.job_index;
      },
      [P._]() {},
    });
    expect(matched).toBe(6);
    console.log(my_arrs);
    expect(my_arrs.len()).toBe(5);
  });
  test("can be indexed like arrays", () => {
    const nums = new FixedArray(null, 3);
    console.log(nums);
    expect(nums[2]).toBe(null);
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

import { describe, expect, test, xdescribe } from "bun:test";
import { FixedArray, vec, Vec } from "../src/vec";
import { OnceLock } from "../src/sync/once-lock";

xdescribe("FixedArray<T, N>", () => {
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

describe("Vec<T>", () => {
  test("can be indexed like arrays", () => {
    const my_nums = Vec.new<string>();
    my_nums.reserve_exact(2);
    my_nums.push("name");
    expect(my_nums.len()).toBe(1);
    expect(my_nums[0]).toBe("name");
  });
  test(".new static call allocates len and capacity of 0", () => {
    const my_nums = Vec.new<string>();
    expect(my_nums.len()).toBe(0);
    expect(my_nums.len()).toBe(my_nums.capacity());
  });
  test(".with_capacity static call sets the capacity", () => {
    const my_nums = Vec.with_capacity<string>(5);
    expect(my_nums.len()).toBe(0);
    expect(my_nums.capacity()).toBe(5);
  });
  test(".get call returns an Option<T>", () => {
    const my_nums = Vec.with_capacity<string>(5);
    expect(my_nums.get(0).is_none()).toEqual(true);
  });
  test(".reserve throws on invalid `additional` argument", () => {
    function throws() {
      const my_vec = Vec.with_capacity<string>(5);
      my_vec.reserve(0);
    }
    expect(throws).toThrowError(Error);
  });
  test(".reserve does not pre-allocate when we have enough pre-allocated slots", () => {
    const my_nums = Vec.with_capacity<number>(5);
    expect(my_nums.capacity()).toBe(5);
    // initialize three elements
    for (let i = 0; i < 3; i++) {
      my_nums.push(i);
    }
    expect(my_nums.len()).toBe(3);
    my_nums.reserve(2);
    expect(my_nums.capacity()).toBe(5);
  });
  test(".reserve pre-allocates when we don't have enough pre-allocated slots", () => {
    const my_nums = Vec.with_capacity<number>(5);
    expect(my_nums.capacity()).toBe(5);
    // initialize five elements filling the length and capacity
    for (let i = 0; i < 5; i++) {
      my_nums.push(i);
    }
    expect(my_nums.len()).toBe(5);
    my_nums.reserve(2);
    expect(my_nums.capacity()).not.toBe(5);
    expect(my_nums.capacity()).toBe(10);
  });
  test(".reserve_exact pre-allocates exact additional slots", () => {
    const my_nums = Vec.with_capacity<number>(5);
    expect(my_nums.capacity()).toBe(5);
    // initialize five elements filling the length and capacity
    for (let i = 0; i < 5; i++) {
      my_nums.push(i);
    }
    expect(my_nums.len()).toBe(5);
    my_nums.reserve_exact(2);
    expect(my_nums.capacity()).not.toBe(5);
    expect(my_nums.capacity()).toBe(7);
  });
  test(".to_array shallow copies the underlying buffer", () => {
    const my_nums = Vec.with_capacity<number>(15);
    for (let i = 0; i < 2; i++) {
      my_nums.push(i);
    }
    expect(my_nums.len()).toBe(2);
    const my_nums_arr = my_nums.to_array();
    expect(my_nums_arr.length).toBe(2);
    expect(my_nums_arr[0]).toBe(0);
  });
  test(".shrink_to_fit shrinks the underlying buffer", () => {
    const my_nums = vec([new OnceLock(), new OnceLock()]);
    my_nums.reserve(3);
    console.log(my_nums, "capacity: ", my_nums.capacity());
    expect(my_nums.capacity()).toBe(5);
    my_nums.shrink_to_fit();
    console.log(my_nums, "capacity: ", my_nums.capacity());
    expect(my_nums.capacity()).toBe(2);
  });
});

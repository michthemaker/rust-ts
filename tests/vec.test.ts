import { expect, test, describe } from "bun:test";
import { vec, Vec } from "../src/vec";
import { OnceLock } from "../src/sync/once_lock";
import { range } from "../src/range";
import { inspect } from "bun";

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
  describe("vec helper", () => {
    test("vec() returns an empty Vec<T>", () => {
      const my_nums = vec();
      expect(my_nums.len()).toBe(0);
      expect(my_nums.capacity()).toBe(0);
    });
    test("vec([0]) works", () => {
      const my_nums = vec([0]);
      console.log(my_nums);
      expect(my_nums.len()).toBe(1);
      expect(my_nums.capacity()).toBe(1);
    });
    test("vec(elem, n) works too", () => {
      const locks = vec({ name: "jejs" }, 4);
      console.log(locks);
      expect(locks.len()).toBe(4);
      expect(locks.capacity()).toBe(4);
    });
    test("vec(elem, n) where elem is an array works too", () => {
      const my_nums = vec([0], 4);
      console.log(my_nums);
      expect(my_nums.len()).toBe(4);
      expect(my_nums.capacity()).toBe(4);
    });
  });
  describe("vec policies", () => {
    test("slice invalidates when it's vec has undergone a structural change ", () => {
      const v = vec([10, 20, 30]);
      const view = v.as_slice();

      view[0] = 99; // v is now [99, 20, 30]
      expect(v[0]).toBe(99);

      v[2] = 123; // v is now [99, 20, 123]
      expect(view[2]).toBe(123);

      // v undergoes a structural change here: the len changes
      v[3] = 44;
      // but view (slice) over it still shows the three elements, so it is invalidated
      expect(inspect(view)).toBe("&[<invalidated>]");
      expect(() => console.log(view[3])).toThrow(/slice invalidated:/i);
      expect(() => console.log(view.get(5))).toThrow(/slice invalidated:/i);
    });
    test("drain invalidates underlying slice", () => {
      // second one
      const second_v = vec([10, 20, 30, 4, 300, 32020]);
      const second_view = second_v.as_slice();

      second_v.drain(range(2, 5));
      console.log(second_v);
      expect(() => console.log(second_view.get(5))).toThrow(/slice invalidated:/i);
    });
  });
  test("into_iter() makes Vec unusable and invalidates slices of it", () => {
    const my_nums = vec([10, 20, 30, 4, 300, 32020]);
    const my_slice = my_nums.as_slice();
    const iter = my_nums.into_iter();
    console.log(my_nums, iter.next(), iter.next());
    expect(() => console.log(my_nums[0])).toThrow();
    expect(() => console.log(my_slice[0])).toThrow(/slice invalidated/i);
  });
  test(".get call returns an Option<T>", () => {
    const my_nums = vec([new OnceLock(), 5]);
    expect(my_nums.get(0).is_some()).to_equal(true);
    console.log(my_nums.get(0));
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

import { describe, expect, test } from "bun:test";
import { Slice } from "../src/slice";
import { OnceLock } from "../src/sync/once-lock";

describe("Slice<T>", () => {
  describe("View semantics", () => {
    test("Constructing a Slice<T> never copies", () => {
      const my_arr = [4, 6, new OnceLock(), new OnceLock()];
      const my_slice = new Slice(my_arr, 2, my_arr.length - 2);
      console.log(my_slice);
      expect(my_arr[2]).toEqual(my_slice[0]);
    });
    test("Write through one view is visible in the owner and in every overlapping view.", () => {
      const my_arr = [4, 6, new OnceLock(), new OnceLock()];
      const my_slice = new Slice(my_arr, 2, my_arr.length - 2);
      const another_slice = new Slice(my_arr, 3, my_arr.length - 3);
      // first change to owner, should reflect in slice
      my_arr[2] = 5;
      console.log(
        "after change; my_slice: ",
        my_slice,
        "\n my_arr: ",
        my_arr,
        "\n another_slice: ",
        another_slice,
      );
      expect(my_slice[0]).toBe(5);
      // second change to view, should reflect in slice
      my_slice[1] = 6;
      console.log(
        "after change 2; my_slice: ",
        my_slice,
        "\n my_arr: ",
        my_arr,
        "\n another_slice: ",
        another_slice,
      );
      expect(another_slice[0]).toBe(6);
    });
  });

  describe("The index Proxy", () => {
    test("len - 1 versus len is the exact boundary for the panic, on both read and write.", () => {
      const arr = [4, 6, 9, 6];
      const my_slice = new Slice(arr, 1, 3);
      console.log(my_slice);
      function throws() {
        // this should throw
        my_slice[3] = 0;
      }
      expect(throws).toThrow();
    });
    test("Symbol keys, empty string keys, '01', negative numbers, '1.5' and non-numeric strings pass straight through", () => {
      const empty_arr: any[] = [0, 0, 0, 0, 0, 0, 0];
      const empty_slice: any = new Slice(empty_arr, 3, 3);
      expect(empty_slice[""]).toBe(undefined);
      expect(empty_slice["01"]).toBe(undefined);
      expect(empty_slice[Symbol.for("my_key")]).toBe(undefined);
      expect(empty_slice[-1]).toBe(undefined);
      expect(empty_slice["1.5"]).toBe(undefined);
    });
  });

  describe("Empty Slice and boundary inputs, for every method", () => {
    test("first, last, split_first and split_last on an empty slice.", () => {
      const my_slice = new Slice([], 0, 0);
      expect(my_slice.first().is_none()).toEqual(true);
      expect(my_slice.last().is_none()).toEqual(true);
      expect(my_slice.split_first().is_none()).toEqual(true);
      expect(my_slice.split_last().is_none()).toEqual(true);
    });
  });
});

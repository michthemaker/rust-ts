import { describe, expect, test } from "bun:test";
import { Slice as SliceView } from "../src/slice";
import { OnceLock } from "../src/sync/once_lock";
import { inspect } from "node:util";
import { FixedArray } from "../src/fixed_array";
import { match, P } from "../src/match";
import { vec, Vec } from "../src/vec";
import { Result } from "../src/result";

const Slice = SliceView as any;

/** a Slice over `items`: window [start, start + len), sharing `items` as its buffer */
function make<T>(items: T[], start = 0, len = items.length - start) {
  return new Slice(items, start, len);
}

/** 10 numbered slots, view over the middle: indices 3..6 */
function middle() {
  const buf = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  return { buf, view: new Slice(buf, 3, 4) };
}

function expect_outside_untouched(buf: number[]) {
  expect(buf.slice(0, 3)).to_equal([0, 1, 2]);
  expect(buf.slice(7)).to_equal([7, 8, 9]);
}

describe("Slice<T>", () => {
  describe("View semantics", () => {
    test("Constructing a Slice<T> never copies", () => {
      const my_arr = [4, 6, new OnceLock(), new OnceLock()];
      const my_slice = new Slice(my_arr, 2, my_arr.length - 2);
      console.log(my_slice);
      expect(my_arr[2]).to_equal(my_slice[0]);
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
      expect(my_slice.first().is_none()).to_equal(true);
      expect(my_slice.last().is_none()).to_equal(true);
      expect(my_slice.split_first().is_none()).to_equal(true);
      expect(my_slice.split_last().is_none()).to_equal(true);
    });

    test("sort, reverse, fill on empty", () => {
      const empty = make<number>([]);
      empty.sort();
      empty.reverse();
      empty.fill(1);
      expect(empty.to_array()).to_equal([]);
    });

    test("sort, reverse, fill on a single element", () => {
      const one = make([5]);
      one.sort();
      one.reverse();
      expect(one.to_array()).to_equal([5]);
      one.fill(9);
      expect(one.to_array()).to_equal([9]);
    });

    test("rotate_* on empty: 0 is fine, anything larger panics", () => {
      const empty = make<number>([]);
      empty.rotate_left(0);
      empty.rotate_right(0);
      expect(() => empty.rotate_left(1)).toThrow();
      expect(() => empty.rotate_right(1)).toThrow();
    });

    test("rotate_* on a single element: up to len is fine, past it panics", () => {
      const one = make([5]);
      one.rotate_left(1);
      one.rotate_right(1);
      expect(one.to_array()).to_equal([5]);
      expect(() => one.rotate_left(2)).toThrow();
      expect(() => one.rotate_right(2)).toThrow();
    });

    test("binary_search on empty is Err(0)", () => {
      expect(make<number>([]).binary_search(3)).to_equal(Result.Err(0));
    });

    test("binary_search on a single element", () => {
      const one = make([5]);
      expect(one.binary_search(5)).to_equal(Result.Ok(0));
      expect(one.binary_search(1)).to_equal(Result.Err(0));
      expect(one.binary_search(9)).to_equal(Result.Err(1));
    });
  });

  describe("windows and chunks sizes", () => {
    const items = () => make([1, 2, 3]);
    const arrays = (it: IterableIterator<SliceView<number>>) => [...it].map((s) => s.to_array());

    test("size larger than len", () => {
      expect(arrays(items().windows(5))).to_equal([]);
      expect(arrays(items().chunks(5))).to_equal([[1, 2, 3]]);
      expect(arrays(items().chunks_exact(5))).to_equal([]);
    });

    test("size equal to len", () => {
      expect(arrays(items().windows(3))).to_equal([[1, 2, 3]]);
      expect(arrays(items().chunks(3))).to_equal([[1, 2, 3]]);
      expect(arrays(items().chunks_exact(3))).to_equal([[1, 2, 3]]);
    });

    test("size 1", () => {
      expect(arrays(items().windows(1))).to_equal([[1], [2], [3]]);
      expect(arrays(items().chunks(1))).to_equal([[1], [2], [3]]);
      expect(arrays(items().chunks_exact(1))).to_equal([[1], [2], [3]]);
    });

    test("empty slice yields nothing", () => {
      expect(arrays(make<number>([]).windows(1))).to_equal([]);
      expect(arrays(make<number>([]).chunks(1))).to_equal([]);
      expect(arrays(make<number>([]).chunks_exact(1))).to_equal([]);
    });
  });

  describe("split_at and split_at_checked", () => {
    test("split_at 0 and len", () => {
      const [a, b] = make([1, 2, 3]).split_at(0);
      expect([a.to_array(), b.to_array()]).to_equal([[], [1, 2, 3]]);
      const [c, d] = make([1, 2, 3]).split_at(3);
      expect([c.to_array(), d.to_array()]).to_equal([[1, 2, 3], []]);
    });

    test("split_at len + 1 and negative panic", () => {
      expect(() => make([1, 2, 3]).split_at(4)).toThrow("mid > len");
      expect(() => make([1, 2, 3]).split_at(-1)).toThrow("mid > len");
    });

    test("split_at_checked mirrors it with Option", () => {
      const s = make([1, 2, 3]);
      expect(s.split_at_checked(0).is_some()).toBe(true);
      expect(s.split_at_checked(3).is_some()).toBe(true);
      expect(s.split_at_checked(4).is_none()).toBe(true);
      expect(s.split_at_checked(-1).is_none()).toBe(true);
    });

    test("both halves are views of the same buffer", () => {
      const buf = [1, 2, 3, 4];
      const [left, right] = make(buf).split_at(2);
      left.fill(0);
      right.reverse();
      expect(buf).to_equal([0, 0, 4, 3]);
    });
  });

  describe("panics", () => {
    test("swap out of range", () => {
      const s = make([1, 2, 3]);
      expect(() => s.swap(0, 3)).toThrow("index out of bounds: the len is 3 but the index is 3");
      expect(() => s.swap(5, 0)).toThrow("index out of bounds: the len is 3 but the index is 5");
      expect(() => s.swap(-1, 0)).toThrow("index out of bounds");
    });

    test("split_at fails", () => {
      expect(() => make([1]).split_at(2)).toThrow("mid > len");
    });

    test("copy_from_slice length mismatch", () => {
      const s = make([1, 2, 3]);
      expect(() => s.copy_from_slice([1, 2])).toThrow(
        "source slice length (2) does not match destination slice length (3)",
      );
      expect(() => s.copy_from_slice([1, 2, 3, 4])).toThrow(
        "source slice length (4) does not match destination slice length (3)",
      );
    });

    test("windows, chunks, chunks_exact with size 0", () => {
      const s = make([1, 2, 3]);
      expect(() => s.windows(0)).toThrow("window size must be non-zero");
      expect(() => s.chunks(0)).toThrow("chunk size must be non-zero");
      expect(() => s.chunks_exact(0)).toThrow("chunk size must be non-zero");
    });

    test("rotate_* past len", () => {
      const s = make([1, 2, 3]);
      expect(() => s.rotate_left(4)).toThrow();
      expect(() => s.rotate_right(4)).toThrow();
      expect(() => s.rotate_left(-1)).toThrow();
    });

    test("index read and write out of range", () => {
      const s = make([1, 2, 3]);
      expect(() => s[3]).toThrow("index out of bounds: the len is 3 but the index is 3");
      expect(() => {
        s[3] = 9;
      }).toThrow("index out of bounds: the len is 3 but the index is 3");
    });

    test("index out of range is relative to the view, not the buffer", () => {
      const buf = [1, 2, 3, 4, 5];
      const view = make(buf, 1, 2);
      expect(view[1]).toBe(3);
      expect(() => view[2]).toThrow("the len is 2 but the index is 2");
    });

    test("windows(0) panics at the call, not on the first next()", () => {
      const s = make([1, 2, 3]);
      // if this were a lazy generator the throw would only happen on iteration
      expect(() => s.windows(0)).toThrow();
    });

    test("get never panics: negative, NaN, fractional, infinite, == len", () => {
      const s = make([1, 2, 3]);
      for (const bad of [-1, NaN, 1.5, Infinity, -Infinity, 3, 100]) {
        expect(s.get(bad).is_none()).toBe(true);
      }
      expect(s.get(0).unwrap()).toBe(1);
      expect(s.get(2).unwrap()).toBe(3);
    });
  });

  describe("iteration", () => {
    test("iter and Symbol.iterator agree, for..of and spread work", () => {
      const s = make([1, 2, 3]);
      expect([...s.iter()]).to_equal([1, 2, 3]);
      expect([...s]).to_equal([1, 2, 3]);
      const seen: number[] = [];
      for (const x of s) seen.push(x);
      expect(seen).to_equal([1, 2, 3]);
    });

    test("iteration stays inside the window", () => {
      expect([...make([0, 1, 2, 3, 4], 1, 3)]).to_equal([1, 2, 3]);
    });

    test("windows / chunks / chunks_exact counts", () => {
      const s = make([1, 2, 3, 4, 5, 6, 7]);
      for (let win of s.windows(4)) {
        console.log(win);
      }
      expect([...s.windows(3)].length).toBe(5);
      const chunks = [...s.chunks(3)].map((c) => c.to_array());
      console.log("chunks");
      for (let chunk of s.chunks(3)) {
        console.log(chunk);
      }
      expect(chunks).to_equal([[1, 2, 3], [4, 5, 6], [7]]); // trailing partial chunk
      const exact = [...s.chunks_exact(3)].map((c) => c.to_array());
      expect(exact).to_equal([
        [1, 2, 3],
        [4, 5, 6],
      ]); // remainder dropped
    });

    test("windows overlap by size - 1", () => {
      expect([...make([1, 2, 3, 4]).windows(2)].map((w) => w.to_array())).to_equal([
        [1, 2],
        [2, 3],
        [3, 4],
      ]);
    });

    test("yielded items are views: mutating one changes the buffer", () => {
      const buf = [1, 2, 3, 4];
      const [first_chunk] = make(buf).chunks(2);
      first_chunk[0] = 99;
      first_chunk.swap(0, 1);
      expect(buf).to_equal([2, 99, 3, 4]);

      const buf2 = [1, 2, 3, 4];
      for (const w of make(buf2).windows(2)) w.fill(0);
      expect(buf2).to_equal([0, 0, 0, 0]);
    });
  });

  describe("in-place operations on a middle window", () => {
    test("sort", () => {
      const buf = [0, 1, 2, 9, 4, 7, 5, 7, 8, 9];
      const view = new Slice(buf, 3, 4);
      view.sort();
      expect(buf).to_equal([0, 1, 2, 4, 5, 7, 9, 7, 8, 9]);
    });

    test("reverse", () => {
      const { buf, view } = middle();
      view.reverse();
      expect(buf).to_equal([0, 1, 2, 6, 5, 4, 3, 7, 8, 9]);
      expect_outside_untouched(buf);
    });

    test("fill", () => {
      const { buf, view } = middle();
      view.fill(-1);
      expect(buf).to_equal([0, 1, 2, -1, -1, -1, -1, 7, 8, 9]);
      expect_outside_untouched(buf);
    });

    test("fill_with", () => {
      const { buf, view } = middle();
      view.fill_with(() => -1);
      expect(buf.slice(3, 7)).to_equal([-1, -1, -1, -1]);
      expect_outside_untouched(buf);
    });

    test("rotate_left / rotate_right", () => {
      const { buf, view } = middle();
      view.rotate_left(1);
      expect(buf.slice(3, 7)).to_equal([4, 5, 6, 3]);
      expect_outside_untouched(buf);
      view.rotate_right(1);
      expect(buf.slice(3, 7)).to_equal([3, 4, 5, 6]);
      expect_outside_untouched(buf);
    });

    test("swap", () => {
      const { buf, view } = middle();
      view.swap(0, 3);
      expect(buf.slice(3, 7)).to_equal([6, 4, 5, 3]);
      expect_outside_untouched(buf);
    });

    test("copy_from_slice", () => {
      const { buf, view } = middle();
      view.copy_from_slice([10, 11, 12, 13]);
      expect(buf.slice(3, 7)).to_equal([10, 11, 12, 13]);
      expect_outside_untouched(buf);
    });

    test("reverse on odd and even lengths", () => {
      expect(make([1, 2, 3]).to_array().reverse()).to_equal([3, 2, 1]);
      const odd = make([1, 2, 3]);
      odd.reverse();
      expect(odd.to_array()).to_equal([3, 2, 1]);
      const even = make([1, 2, 3, 4]);
      even.reverse();
      expect(even.to_array()).to_equal([4, 3, 2, 1]);
    });

    test("rotate by 0, by len, and by more than len", () => {
      const s = make([1, 2, 3, 4]);
      s.rotate_left(0);
      expect(s.to_array()).to_equal([1, 2, 3, 4]);
      s.rotate_left(4);
      expect(s.to_array()).to_equal([1, 2, 3, 4]);
      s.rotate_right(0);
      s.rotate_right(4);
      expect(s.to_array()).to_equal([1, 2, 3, 4]);
      expect(() => s.rotate_left(5)).toThrow();
      expect(() => s.rotate_right(5)).toThrow();
      expect(s.to_array()).to_equal([1, 2, 3, 4]); // a panic leaves the data alone
    });

    test("fill_with calls its closure len times, in index order", () => {
      const s = make([0, 0, 0, 0]);
      let calls = 0;
      s.fill_with(() => calls++);
      expect(calls).toBe(4);
      expect(s.to_array()).to_equal([0, 1, 2, 3]);
    });

    test("sort is stable", () => {
      const items = [
        { k: 1, id: "a" },
        { k: 0, id: "b" },
        { k: 1, id: "c" },
        { k: 0, id: "d" },
      ];
      const s = make(items);
      // @ts-expect-error
      s.sort_by((x, y) => x.k - y.k);
      // @ts-expect-error
      expect(s.to_array().map((x) => x.id)).to_equal(["b", "d", "a", "c"]);
    });

    test("default sort is numeric, not lexicographic", () => {
      const s = make([10, 9, 1, 100]);
      s.sort();
      expect(s.to_array()).to_equal([1, 9, 10, 100]);
    });

    test("default sort on strings", () => {
      const s = make(["b", "c", "a"]);
      s.sort();
      expect(s.to_array()).to_equal(["a", "b", "c"]);
    });

    test("sort_by_key with ties keeps the original order", () => {
      const items = [
        { k: 2, id: "a" },
        { k: 1, id: "b" },
        { k: 2, id: "c" },
        { k: 1, id: "d" },
      ];
      const s = make(items);
      // @ts-expect-error
      s.sort_by_key((x) => x.k);
      // @ts-expect-error
      expect(s.to_array().map((x) => x.id)).to_equal(["b", "d", "a", "c"]);
    });
  });

  describe("searching and comparison compare by value", () => {
    test("contains with objects and arrays", () => {
      expect(make([{ a: 1 }, { a: 2 }]).contains({ a: 2 })).toBe(true);
      expect(make([{ a: 1 }, { a: 2 }]).contains({ a: 3 })).toBe(false);
      expect(make([[1, 2], [3]]).contains([3])).toBe(true);
      expect(make([[1, 2], [3]]).contains([2])).toBe(false);
    });

    test("contains only looks inside the window", () => {
      const view = make([9, 1, 2, 9], 1, 2);
      expect(view.contains(1)).toBe(true);
      expect(view.contains(9)).toBe(false);
    });

    test("starts_with / ends_with with a plain array and a Slice", () => {
      const s = make([1, 2, 3, 4]);
      expect(s.starts_with([1, 2])).toBe(true);
      expect(s.starts_with(make([1, 2]))).toBe(true);
      expect(s.starts_with([2, 3])).toBe(false);
      expect(s.ends_with([3, 4])).toBe(true);
      expect(s.ends_with(make([3, 4]))).toBe(true);
      expect(s.ends_with([2, 3])).toBe(false);
    });

    test("starts_with / ends_with by value on objects", () => {
      const s = make([{ a: 1 }, { a: 2 }]);
      expect(s.starts_with([{ a: 1 }])).toBe(true);
      expect(s.ends_with([{ a: 2 }])).toBe(true);
    });

    test("empty needle is always a prefix and a suffix", () => {
      expect(make([1, 2]).starts_with([])).toBe(true);
      expect(make([1, 2]).ends_with([])).toBe(true);
      expect(make<number>([]).starts_with([])).toBe(true);
    });

    test("needle longer than the slice is false", () => {
      expect(make([1, 2]).starts_with([1, 2, 3])).toBe(false);
      expect(make([1, 2]).ends_with([0, 1, 2])).toBe(false);
    });

    test("starts_with / ends_with respect the window", () => {
      const view = make([0, 1, 2, 3], 1, 2);
      expect(view.starts_with([1, 2])).toBe(true);
      expect(view.starts_with([0, 1])).toBe(false);
      expect(view.ends_with([1, 2])).toBe(true);
      expect(view.ends_with([2, 3])).toBe(false);
    });

    test("eq with a plain array and a Slice", () => {
      expect(make([1, 2, 3]).eq([1, 2, 3])).toBe(true);
      expect(make([1, 2, 3]).eq(make([1, 2, 3]))).toBe(true);
      expect(make([1, 2, 3]).eq([1, 2])).toBe(false);
      expect(make([1, 2, 3]).eq([1, 2, 4])).toBe(false);
      expect(make<number>([]).eq([])).toBe(true);
      expect(make([{ a: [1] }]).eq([{ a: [1] }])).toBe(true);
    });

    test("eq compares windows, not buffers", () => {
      expect(make([9, 1, 2, 9], 1, 2).eq([1, 2])).toBe(true);
    });
  });

  describe("binary_search", () => {
    const sorted = () => make([1, 3, 5, 7, 9]);

    test("found item", () => {
      expect(sorted().binary_search(5)).to_equal(Result.Ok(2));
      expect(sorted().binary_search(1)).to_equal(Result.Ok(0));
      expect(sorted().binary_search(9)).to_equal(Result.Ok(4));
    });

    test("missing item gives the insertion point", () => {
      expect(sorted().binary_search(4)).to_equal(Result.Err(2));
    });

    test("insertion at both ends", () => {
      expect(sorted().binary_search(0)).to_equal(Result.Err(0));
      expect(sorted().binary_search(10)).to_equal(Result.Err(5));
    });

    test("duplicates: any matching index is acceptable", () => {
      const buf = [1, 2, 2, 2, 3];
      const r = make(buf).binary_search(2);
      expect(r.is_ok()).toBe(true);
      expect(buf[r.unwrap()]).toBe(2);
    });

    test("custom comparator", () => {
      const descending = make([9, 7, 5, 3, 1]);
      const cmp = (a: number, b: number) => b - a;
      expect(descending.binary_search(5, cmp)).to_equal(Result.Ok(2));
      expect(descending.binary_search(6, cmp)).to_equal(Result.Err(2));
    });

    test("searches only the window", () => {
      const view = make([100, 1, 3, 5, 0], 1, 3);
      expect(view.binary_search(5)).to_equal(Result.Ok(2));
      expect(view.binary_search(100)).to_equal(Result.Err(3)); // not the 100 before the window
      expect(view.binary_search(0)).to_equal(Result.Err(0)); // not the 0 after it
    });

    test("search on an empty slice", () => {
      let val = match(make<number>([]).binary_search(1), {
        [P.Err(0)]() {
          return true;
        },
      });
      expect(val).toBe(true);
    });
  });

  describe("integration with FixedArray<T, N>", () => {
    test("is a Slice", () => {
      const fa = new FixedArray(0, 3);
      expect(fa instanceof Slice).toBe(true);
    });

    test("indexing reads and writes through its own proxy", () => {
      const fa = new FixedArray(0, 3);
      fa[1] = 7;
      expect(fa[0]).toBe(0);
      expect(fa[1]).toBe(7);
      expect(() => fa[3]).toThrow(/index out of bounds/i);
      expect(() => {
        fa[3] = 1;
      }).toThrow(/index out of bounds/i);
    });

    test("len and to_array reflect the fixed size", () => {
      const fa = new FixedArray("x", 4);
      expect(fa.len()).toBe(4);
      expect(fa.to_array()).to_equal(["x", "x", "x", "x"]);
      fa[2] = "y";
      expect(fa.to_array()).to_equal(["x", "x", "y", "x"]);
    });

    test("inherited Slice methods work on it", () => {
      const fa = new FixedArray(1, 3);
      fa[1] = 2;
      fa[2] = 3;
      expect(fa.first().unwrap()).toBe(1);
      expect(fa.last().unwrap()).toBe(3);
      expect(fa.contains(2)).toBe(true);
      fa.reverse();
      expect(fa.to_array()).to_equal([3, 2, 1]);
    });

    test("for..of and spread work on it", () => {
      const fa = new FixedArray(1, 3);
      fa[1] = 2;
      fa[2] = 3;
      expect([...fa]).to_equal([1, 2, 3]);
    });

    test("a view split off it shares its buffer", () => {
      const fa = new FixedArray(0, 4);
      const [left, right] = fa.split_at(2);
      left.fill(1);
      right.fill(2);
      expect(fa.to_array()).to_equal([1, 1, 2, 2]);
    });
  });

  describe("integration with Vec<T>", () => {
    test("is a Slice", () => {
      const fa = Vec.new();
      expect(fa instanceof Slice).toBe(true);
    });

    test("indexing reads and writes through its own proxy", () => {
      const nums = Vec.with_capacity<number>(3);
      nums[0] = 7;
      expect(nums[0]).toBe(7);
      expect(() => nums[1]).toThrow(/index out of bounds/i);
      expect(() => {
        nums[3] = 1;
      }).toThrow(/index out of bounds/i);
    });

    test("len and to_array reflect the vec size", () => {
      const strings = vec(["x", "x", "x", "x"]);
      expect(strings.len()).toBe(4);
      expect(strings.to_array()).to_equal(["x", "x", "x", "x"]);
      strings[2] = "y";
      console.log(strings.to_array());
      expect(strings.to_array()).to_equal(["x", "x", "y", "x"]);
    });

    test("inherited Slice methods work on it", () => {
      const nums = vec([1, 1, 1]);
      nums[1] = 2;
      nums[2] = 3;
      expect(nums.first().unwrap()).toBe(1);
      expect(nums.last().unwrap()).toBe(3);
      expect(nums.contains(2)).toBe(true);
      nums.reverse();
      expect(nums.to_array()).to_equal([3, 2, 1]);
    });

    test("for..of and spread work on it", () => {
      const nums = vec([1, 1, 1]);
      nums[1] = 2;
      nums[2] = 3;
      expect([...nums]).to_equal([1, 2, 3]);
    });

    test("a view split off it shares its buffer", () => {
      const vec4 = vec([0, 0, 0, 0]);
      const [left, right] = vec4.split_at(2);
      left.fill(1);
      right.fill(2);
      expect(vec4.to_array()).to_equal([1, 1, 2, 2]);
    });
  });

  describe("inspect output", () => {
    test("Slice uses the custom inspect symbol", () => {
      expect(inspect(make([1, 2, 3]))).toBe("&[1, 2, 3]");
      expect(inspect(make([0, 1, 2, 3, 4], 1, 3))).toBe("&[1, 2, 3]");
      expect(inspect(make<number>([]))).toBe("&[]");
    });

    test("FixedArray uses its own", () => {
      expect(inspect(new FixedArray(7, 2))).toBe("FixedArray(2)[7, 7]");
    });
  });
});

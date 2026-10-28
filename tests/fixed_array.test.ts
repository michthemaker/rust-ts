import { FixedArray } from "../src/array.ts";
import { describe, test, expect } from "bun:test";
import { match, P } from "../src/match_impl.ts";
import { async_drop, drop } from "../src/mem.ts";
import { AsyncDrop, Drop } from "../src/ops.ts";
import { impl } from "../src/trait_impl.ts";

describe("FixedArray<T, N>", () => {
	test("can be indexed like arrays", () => {
		const nums = new FixedArray(5, 3);
		console.log(nums);
		expect(nums[2]).toBe(5);
	});
	test(".from_fn static call allocates array of size", () => {
		const my_arrs = FixedArray.from_fn(5, (i) => ({ name: "John", job_index: i * 3 }));
		const matched = match(my_arrs.get(2), {
			[P.Some({ name: "John", job_index: 6 })](v) {
				return v.job_index;
			},
			[P._]() {
				return 7;
			}
		});
		expect(matched).toBe(6);
		console.log(my_arrs);
		expect(my_arrs.len()).toBe(5);
	});
	test(".map returns array of the same length ", () => {
		const my_nums = new FixedArray("string", 5);
		const mapped = my_nums.map((v, i) => ({ index: i * i, v }));
		expect(mapped.len()).toBe(5);
		console.log(mapped);
		expect(mapped.get(2).unwrap()).to_equal({ index: 4, v: "string" });
	});
	test(".to_vec returns a Vec<T> of same length ", () => {
		const fixed_arr = FixedArray.from_fn(5, (i) => `${i} string`);
		const to_vec = fixed_arr.to_vec();
		console.log(to_vec);
		expect(fixed_arr.len() as number).toBe(to_vec.len());
		expect(to_vec.len()).toBe(5);
		expect(to_vec.capacity()).toBe(5);
		expect(to_vec[2]).toBe("2 string");
	});
	test(".clone makes a new FixedArray<T, N> ", () => {
		const my_nums = new FixedArray("string", 5);
		const cloned = my_nums.clone();
		expect(my_nums.len()).toBe(cloned.len());
		expect(my_nums).not.toBe(cloned);
		console.log(my_nums, "\tmain");
		console.log(cloned, "\tcloned");
		expect(my_nums.get(2).unwrap()).to_equal(cloned.get(2).unwrap());
	});
	test("throws on .set index out of bounds", () => {
		function throws() {
			const nums = new FixedArray(4, 4);
			// @ts-ignore
			nums[4] = 9;
		}
		expect(throws).toThrow();
	});
	test("throws on .get index out of bounds", () => {
		function throws() {
			const nums = new FixedArray(4, 4);
			// @ts-ignore
			console.log(nums[8]);
		}
		expect(throws).toThrow();
	});
	describe("Drop and AsyncDrop", () => {
		test("async drop", () => {
			class MyClass {
				[Symbol.dispose]() {}
			}

			expect(() => drop(new FixedArray(new MyClass(), 3))).toThrow();
			expect(() => drop(new MyClass())).toThrow(/async/i);
			expect(async () => await async_drop(new FixedArray(new MyClass(), 3))).not.toThrow();
		});
		test("Test sync drops", () => {
			// this passed
			expect(() => {
				const arr = FixedArray([0, 0], 3);
				drop(arr);
				drop(arr);
			}).toThrow(/cannot drop a dropped value/i);
			// this passed
			expect(() => {
				class MyClass extends impl(AsyncDrop) {
					async [Symbol.asyncDispose]() {}
				}
				const arr = FixedArray(new MyClass(), 2);
				drop(arr);
			}).toThrow(/cannot synchro/i);
			// this passed
			expect(() => {
				class MyClass extends impl(AsyncDrop) {
					async [Symbol.asyncDispose]() {}
				}
				const arr = FixedArray(FixedArray(0, 1), 2);
				// @ts-ignore
				arr[1] = new MyClass();
				async_drop(arr);
				console.log(arr); // FixedArray(2)[FixedArray(1)[], MyClass {}]
			}).not.toThrow();
		});
		test("Drop subsequent items after failing sync drop", () => {
			class Boom extends impl(Drop) {
				[Symbol.dispose]() {
					throw new Error("boom");
				}
			}

			const arr = FixedArray<any, 4>(0, 4);
			const inner = FixedArray(0, 1);
			arr[1] = new Boom();
			arr[2] = inner;

			expect(() => drop(arr)).toThrow(/boom/);
			// the sibling after the failing element was still dropped
			expect(() => drop(inner)).toThrow(/cannot drop a dropped value/i);
		});
		test("sync drop on mixed async-only and sync or sync and async doesn't continue dropping subsequent elements", () => {
			class MyClass extends impl(AsyncDrop) {
				async [Symbol.asyncDispose]() {}
			}

			const arr2 = FixedArray<any, 3>(0, 3);
			const inner2 = FixedArray(0, 1);
			arr2[0] = inner2;
			arr2[1] = new MyClass(); // async-only

			expect(() => drop(arr2)).toThrow(/cannot synchro/i);
			expect(() => drop(inner2)).not.toThrow(); // nothing was consumed
			console.log(arr2);
		});
		test("aggregate thrown for many errors", () => {
			class MyClass extends impl(Drop) {
				[Symbol.dispose]() {
					throw new Error("just threw");
				}
			}

			const arr2 = FixedArray<any, 9>(0, 9);
			const inner2 = FixedArray(0, 1);
			arr2[0] = new MyClass();
			arr2[1] = new MyClass();
			arr2[2] = new MyClass();
			arr2[8] = inner2;

			expect(() => drop(arr2)).toThrowError(AggregateError);
			console.log(arr2);
		});
	});
});

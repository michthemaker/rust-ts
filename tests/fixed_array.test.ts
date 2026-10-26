import { FixedArray } from "../src/array.ts";
import { describe, test, expect } from "bun:test";
import { match, P } from "../src/match_impl.ts";
import { OnceLock } from "../src/sync/once_lock.ts";
import { drop } from "../src/mem.ts";
import { impl } from "../src/trait_impl.ts";
import { AsyncDrop, Drop } from "../src/ops.ts";
import { noop } from "../lib/noop.ts";

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
		test("Double drop throws", () => {
			const mine = FixedArray(FixedArray({}, 6), 8);
			// console.log(mine);
			drop(mine);
			expect(() => drop(mine)).toThrow(/cannot drop a dropped/i);
		});
		test("use-after-drop throws", () => {
			new OnceLock();

			// @ts-expect-error
			class Mine extends impl(AsyncDrop) {}
			// @ts-expect-error
			class Us extends impl(Drop) {}
			const meandyou = FixedArray(new Mine(), 0);
			const us_e = FixedArray.from_fn(3, (index) => {
				if (index === 2) return new Us();
				else return new Mine();
			});
			const mine = new FixedArray(meandyou, 8);
			drop(mine);
			noop(us_e);

			expect(() => mine[0]).toThrow();
			// @ts-expect-error
			expect(() => (mine[0] = 3)).toThrow();
			// @ts-expect-error
			expect(() => delete mine[0]).toThrow();
		});
	});
});

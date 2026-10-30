import { describe, expect, test } from "bun:test";
import { OnceLock } from "../src/sync/once_lock.ts";
import { Result } from "../src/result.ts";
import { Option } from "../src/option.ts";
import { impl } from "../src/trait_impl.ts";
import { AsyncDrop, Container, Drop } from "../src/ops.ts";
import { async_drop, drop } from "../src/mem.ts";
import { Vec } from "../src/vec.ts";
import { println } from "../src/println_impl.ts";

describe("OnceLock<T>", () => {
	// test("", () => {})
	test(".set returns a Ok<T, E>", () => {
		const BRIGHTNESS = new OnceLock<number>();
		expect(BRIGHTNESS.set(9200)).to_equal(Result.Ok<null, number>(null));
	});
	test("double .set returns a Err<T, E>", () => {
		const BRIGHTNESS = new OnceLock<number>();
		expect(BRIGHTNESS.set(9200)).to_equal(Result.Ok<null, number>(null));
		expect(BRIGHTNESS.set(299)).to_equal(Result.Err<null, number>(299));
	});
	test(".take reverts it back to uninitialized state", () => {
		const BRIGHTNESS = new OnceLock<number>();
		expect(BRIGHTNESS.set(9200)).to_equal(Result.Ok<null, number>(null));
		expect(BRIGHTNESS.take()).to_equal(Option.Some(9200));
		expect(BRIGHTNESS.set(48000)).to_equal(Result.Ok<null, number>(null));
		expect(BRIGHTNESS.get()).to_equal(Option.Some(48000));
	});
	test(".get_or_init", () => {
		const BRIGHTNESS = new OnceLock<number>();
		expect(
			BRIGHTNESS.get_or_init(() => {
				return 9020;
			})
		).to_equal(9020);
		expect(
			BRIGHTNESS.get_or_init(() => {
				return 4000;
			})
		).to_equal(9020);
		expect(BRIGHTNESS.take()).to_equal(Option.Some(9020));
		expect(
			BRIGHTNESS.get_or_init(() => {
				return 4000;
			})
		).to_equal(4000);
	});
	test(".get_or_init fails with .thenables", () => {
		type Future<T> = {
			then<T1 = T, T2 = never>(
				onfulfilled?: ((value: T) => T1 | Future<T1>) | undefined | null,
				onrejected?: ((reason: any) => T2 | Future<T2>) | undefined | null
			): Future<T1 | T2>;
		};
		// @ts-expect-error
		const BRIGHTNESS = new OnceLock<Future>();
		expect(() =>
			// @ts-expect-error
			BRIGHTNESS.get_or_init(() => {
				return {
					then() {}
				};
			})
		).toThrow();
	});
	describe("Drop and AsyncDrop traits", () => {
		class MyClass3 extends impl(Drop, AsyncDrop, Container) {
			[Symbol.dispose]() {
				console.log("dropped Myclass3");
			}
			async [Symbol.asyncDispose]() {
				console.log("checked");
			}
		}
		class MyClass4 extends impl(Drop, AsyncDrop) {
			[Symbol.dispose]() {}
			async [Symbol.asyncDispose]() {}
		}
		const BRIGHTNESS = new OnceLock<MyClass3>();
		// @ts-expect-error
		const SECOND_BRIGHTNESS = new OnceLock<MyClass4>();
		// @ts-expect-error
		const THIRD_BRIGHTNESS = new OnceLock<MyClass4>();
		const NUMBERS = new OnceLock<Vec<number>>();
		BRIGHTNESS.set(new MyClass3());
		// @ts-expect-error
		SECOND_BRIGHTNESS.set(new MyClass4());
		// @ts-expect-error
		THIRD_BRIGHTNESS.set(new MyClass4());
		NUMBERS.set(Vec.from_elem(9, 3));
		println("{:?}", NUMBERS);
		test("double drop variants", async () => {
			expect(() => {
				drop(BRIGHTNESS);
				drop(BRIGHTNESS);
			}).toThrow(/cannot drop a dropp/i);
			expect(async () => {
				await async_drop(SECOND_BRIGHTNESS);
				await async_drop(SECOND_BRIGHTNESS);
			}).toThrow(/cannot drop a dropp/i);
		});
		test("drop on an AsyncDrop value fails", () => {
			expect(() => {
				drop(THIRD_BRIGHTNESS);
			}).toThrow();
			expect(() => {
				async_drop(THIRD_BRIGHTNESS);
			}).not.toThrow();
		});
		test("use-after-drop fails", () => {
			expect(() => {
				async_drop(NUMBERS);
			}).not.toThrow();
			expect(() => {
				NUMBERS.take();
			}).toThrow(/use of dropp/i);
			println("{:?}", NUMBERS);
		});
	});
});

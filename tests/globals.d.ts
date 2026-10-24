// global.d.ts or at the top of your test helper
declare module "bun:test" {
	interface Matchers<T> {
		to_equal(expected: T): void;
	}
}

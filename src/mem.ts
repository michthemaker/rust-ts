import { is_iterable } from "../lib/iterable.ts";
import { AsyncDrop, Drop } from "./ops.ts";
import { impls, type TraitInstance } from "./trait_impl.ts";

type DropError<Msg extends string> = { [K in Msg]: never };

type CheckDrop<T> = [T] extends [TraitInstance<typeof AsyncDrop>]
	? [T] extends [Iterable<unknown>]
		? [T] extends [TraitInstance<typeof Drop>]
			? unknown // iterable with AsyncDrop + Drop: ok (Vec, FixedArray, yours)
			: DropError<"AsyncDrop-only iterable: implement Drop too, or use async_drop">
		: DropError<"cannot synchronously drop an AsyncDrop value: use async_drop">
	: [T] extends [TraitInstance<typeof Drop>]
		? unknown // Drop only: ok
		: DropError<"the trait bound `Drop` is not satisfied">;

/**
 * Disposes of a value by calling `[Symbol.dispose]()` on it.
 *
 * @remarks Dropping consumes the value: any later use panics. Containers such as
 * `FixedArray<T, N>`, `Vec<T>` or a custom Iterable that implements both `Drop` and `AsyncDrop`
 * dispose their elements in order and then become unusable.
 *
 * - A throwing element does not stop the others. Every element is disposed, the container is
 *   consumed, and the error is rethrown (an `AggregateError` if several elements threw).
 * - If an element is async-only (implements `AsyncDrop` but not `Drop`), `drop` throws before
 *   disposing anything. The container is left intact, so `async_drop` can still be used on it.
 * - A custom Iterable that implements both traits is responsible for disposing its own elements.
 *
 * @throws when the value does not implement `Drop`, is an async-only value, contains an
 * async-only element, or was already dropped
 * @example
 * ```typescript
 * class Connection extends impl(Drop) {
 * 	[Symbol.dispose]() { console.log("closed"); }
 * }
 *
 * drop(new Connection()); // logs "closed"
 *
 * const pool = FixedArray(new Connection(), 2);
 * drop(pool); // logs "closed" twice, pool is now consumed
 * drop(pool); // throws: cannot drop a dropped value
 *
 * // nested containers: the inner arrays are disposed too
 * const grid = FixedArray(FixedArray(9, 8), 2);
 * drop(grid);
 *
 * class Socket extends impl(AsyncDrop) {
 * 	async [Symbol.asyncDispose]() { ... }
 * }
 *
 * drop(new Socket()); // type error, and throws at runtime: use async_drop
 *
 * // refused before anything is disposed, so the array is still usable
 * const sockets = FixedArray(new Socket(), 3);
 * drop(sockets); // throws: cannot synchronously drop an asynchronous resource
 * await async_drop(sockets); // works: disposes all three
 * ```
 */
export function drop<T>(resource: T & CheckDrop<T>): void;
export function drop(resource: any) {
	const impls_sync_drop = impls(resource, Drop);
	if (impls(resource, AsyncDrop)) {
		if (is_iterable(resource) && impls_sync_drop) return resource[Symbol.dispose]();
		throw new Error("cannot synchronously drop an asynchronous resource. Use async_drop instead.");
	}

	if (impls_sync_drop) {
		return resource[Symbol.dispose]();
	}

	const type_name = (resource as any)?.constructor?.name ?? typeof resource;
	throw new Error(`the trait bound \`${type_name}: Drop\` is not satisfied`);
}

/**
 * Disposes of an asynchronous value by calling `[Symbol.asyncDispose]()` on it.
 *
 * @remarks The returned promise must be awaited. Dropping consumes the value, just like `drop`.
 * Containers dispose their elements in order: `AsyncDrop` elements are awaited and `Drop`-only
 * elements are disposed synchronously, so mixed containers are fine. A throwing element does not
 * stop the others, and the error is rethrown once all elements have been processed (an
 * `AggregateError` if several threw).
 *
 * @throws when the value does not implement `AsyncDrop` or was already dropped
 * @example
 * ```typescript
 * class Connection extends impl(Drop) {
 * 	[Symbol.dispose]() { console.log("closed"); }
 * }
 * class Socket extends impl(AsyncDrop) {
 * 	async [Symbol.asyncDispose]() { ... }
 * }
 *
 * await async_drop(new Socket());
 *
 * // mixed container: Sockets are awaited, plain Drop values are disposed synchronously
 * const mixed = FixedArray<any, 2>(0, 2);
 * mixed[0] = new Socket();
 * mixed[1] = new Connection();
 * await async_drop(mixed) // dropped
 *
 * async_drop(new Connection()); // type error: Connection does not implement AsyncDrop
 * ```
 */
export async function async_drop<T extends TraitInstance<typeof AsyncDrop>>(
	resource: T
): Promise<void> {
	if (impls(resource, AsyncDrop)) {
		return await resource[Symbol.asyncDispose]();
	}

	const type_name = (resource as any)?.constructor?.name ?? typeof resource;
	throw new Error(`the trait bound \`${type_name}: AsyncDrop\` is not satisfied`);
}

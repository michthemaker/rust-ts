import { is_thenable } from "../lib/is_thenable.ts";
import { AsyncDrop, Container, Drop } from "./ops.ts";
import { impls, type TraitInstance } from "./trait_impl.ts";

type DropError<Msg extends string> = { [K in Msg]: never };

type CheckDrop<T> = [T] extends [TraitInstance<typeof AsyncDrop>]
	? [T] extends [TraitInstance<typeof Container>]
		? [T] extends [TraitInstance<typeof Drop>]
			? unknown // Container with AsyncDrop + Drop: ok (Vec, FixedArray, OnceLock, yours)
			: DropError<"drop(): this container is async-only. Use `await async_drop(x)`, or implement Drop on it">
		: [T] extends [TraitInstance<typeof Drop>]
			? DropError<"drop(): implements both Drop and AsyncDrop but is not a Container. Remove one trait, or add Container if it owns other values">
			: DropError<"drop(): this value is async-only and cannot be dropped synchronously. Use `await async_drop(x)`">
	: [T] extends [TraitInstance<typeof Drop>]
		? unknown // Drop only: ok
		: DropError<"drop(): this value does not implement Drop. Add `impl(Drop)` and a [Symbol.dispose]() method">;

const DROPPED = new WeakSet<object>();
const is_object = (v: unknown): v is object =>
	(typeof v === "object" && v !== null) || typeof v === "function";
const name_of = (v: unknown) => (v === null ? "null" : ((v as any)?.constructor?.name ?? typeof v));
function panic(msg: string): never {
	throw new Error(msg);
}

/**
 * Disposes of a value by calling `[Symbol.dispose]()` on it.
 *
 * @remarks Dropping consumes the value: any later use panics. Containers (types that implement
 * `Container`, such as `FixedArray<T, N>`, `Vec<T>`, `Tuple` and `OnceLock<T>`) dispose the
 * values they own in order and then become unusable.
 *
 * - A throwing element does not stop the others. Every element is disposed, the container is
 *   consumed, and the error is rethrown (an `AggregateError` if several elements threw).
 * - If an element is async-only (implements `AsyncDrop` but not `Drop`), `drop` throws before
 *   disposing anything. The container is left intact, so `async_drop` can still be used on it.
 * - A type may implement both `Drop` and `AsyncDrop` only if it is also a `Container`. A plain
 *   class implementing both is rejected at the type level, because `drop` could not tell which
 *   path to take. Containers are responsible for disposing the values they own.
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
 *
 * // type error: implements both traits but is not a Container
 * class Both extends impl(Drop, AsyncDrop) { ... }
 * drop(new Both());
 *
 * // no error: implements both traits and is a Container
 * class Both_Container extends impl(Drop, AsyncDrop, Container) { ... }
 * drop(new Both_Container());
 * ```
 */
export function drop<T>(resource: T & CheckDrop<T>): void;
export function drop(resource: any) {
	if (is_object(resource) && DROPPED.has(resource)) panic("cannot drop a dropped value");

	const sync = impls(resource, Drop);
	const async_ = impls(resource, AsyncDrop);

	if (async_ && !sync)
		panic("cannot synchronously drop an asynchronous resource. Use `await async_drop(x)` instead.");
	if (async_ && sync && !impls(resource, Container))
		panic(
			`\`${name_of(resource)}\` implements both Drop and AsyncDrop but is not a Container. Remove one trait, or add Container if it owns other values.`
		);
	if (!sync) panic(`the trait bound \`${name_of(resource)}: Drop\` is not satisfied`);

	// plain values are consumed from here on, even if dispose throws.
	// Containers track this themselves, since they can still refuse after validation.
	if (is_object(resource) && !impls(resource, Container)) DROPPED.add(resource);

	const result = resource[Symbol.dispose]();
	if (is_thenable(result))
		panic(
			`\`${name_of(resource)}[Symbol.dispose]\` returned a promise. Implement AsyncDrop instead of using an async dispose.`
		);
}

/**
 * Disposes of an asynchronous value by calling `[Symbol.asyncDispose]()` on it.
 *
 * @remarks The returned promise must be awaited. Dropping consumes the value, just like `drop`.
 * Containers dispose the values they own in order: `AsyncDrop` elements are awaited and
 * `Drop`-only elements are disposed synchronously, so containers holding either kind are fine.
 * A throwing element does not stop the others, and the error is rethrown once all elements have
 * been processed (an `AggregateError` if several threw).
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
 * // collections are homogeneous, so mix kinds with a Tuple:
 * // Sockets are awaited, plain Drop values are disposed synchronously
 * const mixed = Tuple(new Socket(), new Connection());
 * await async_drop(mixed); // both disposed, mixed is now consumed
 *
 * async_drop(new Connection()); // type error: Connection does not implement AsyncDrop
 * ```
 */
export async function async_drop<T extends TraitInstance<typeof AsyncDrop>>(
	resource: T
): Promise<void> {
	if (is_object(resource) && DROPPED.has(resource)) panic("cannot drop a dropped value");
	if (!impls(resource, AsyncDrop))
		panic(`the trait bound \`${name_of(resource)}: AsyncDrop\` is not satisfied`);

	// same rule: only non-containers go in the set. Marked before awaiting so a concurrent
	// second call panics. Containers must set their own flag before their first await.
	if (is_object(resource) && !impls(resource, Container)) DROPPED.add(resource as object);
	await resource[Symbol.asyncDispose]();
}

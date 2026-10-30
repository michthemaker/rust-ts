import { Clone } from "./clone.ts";
import { PartialEq } from "./cmp.ts";
import type { Debug } from "./fmt.ts";
import type { AsyncDrop, Container, Drop } from "./ops.ts";
import { type TraitInstance } from "./trait_impl.ts";
import { Tuple as Impl } from "./tuple_impl.ts";

/** "0", "1", ... only: the explicit positions, each with its own type */
type Indices<T extends readonly unknown[]> = {
	[K in Extract<keyof T, `${number}`>]: T[K];
};

/** every other array member stays in the type, because destructuring needs it, but is `never`, so using it is an error */
type OtherMembers<T extends readonly unknown[]> = {
	readonly [K in Exclude<keyof T, `${number}` | number>]: K extends typeof Symbol.iterator
		? T[K]
		: never;
};

interface Traits<T extends readonly unknown[]>
	extends
		TraitInstance<typeof Clone<Tuple<T>>>, // the ke string is just for testing, leave it
		TraitInstance<typeof PartialEq<Tuple<unknown[]>>>,
		TraitInstance<typeof Debug>,
		TraitInstance<typeof Drop>,
		TraitInstance<typeof AsyncDrop>,
		TraitInstance<typeof Container> {}

/**
 * The type of a `Tuple`: typed positions (`"0"`, `"1"`, ...), `Debug`, `Clone` and `PartialEq`,
 * and the iterator that destructuring uses. Every other array member is `never`.
 * See the `Tuple` function for the move and drop rules.
 */
export type Tuple<T extends readonly unknown[]> = Indices<T> & OtherMembers<T> & Traits<T>;

/**
 * A fixed-length sequence whose positions each have their own type. This is Rust's tuple,
 * `(A, B, C)`.
 *
 * @remarks Collections such as `Vec<T>` and `FixedArray<T, N>` are homogeneous. Use a `Tuple`
 * when the values have different types, or to return several values at once.
 *
 * - **Reading:** `t[0]`, `t[1]`, ... are typed per position and never move the value. Reading
 *   past the end panics. Array methods are deliberately unavailable (typed `never`); only
 *   indexing and destructuring are supported.
 * - **Read-only:** assigning to a position throws a `TypeError`.
 * - **Destructuring moves:** `const [a, b] = t` empties each slot as it is taken. Reading an
 *   emptied slot panics with "use of moved value". This mirrors Rust's partial moves: slots you
 *   did not take stay owned by the tuple. TypeScript cannot track moves, so this is enforced at
 *   runtime only.
 * - **Partially moved tuples:** `eq`, `ne` and `clone` panic, and `{:?}` prints `<moved>` for
 *   the emptied slots.
 * - **Dropping:** a `Tuple` implements `Container`, `Drop` and `AsyncDrop`. Dropping disposes the
 *   elements in index order and skips slots that were moved out, so a value you destructured and
 *   dropped yourself is never disposed twice. A throwing element does not stop the others; the
 *   error is rethrown (an `AggregateError` if several threw). If an element is async-only,
 *   `drop` throws before disposing anything and `async_drop` can still be used. After a drop the
 *   tuple is unusable and prints as `(<dropped>)`.
 * - **Traits:** `Debug`, `Clone` and `PartialEq`. Elements are compared and cloned one by one.
 *
 * ### Differences from Rust
 * - Destructuring empties every slot it yields, whatever the type. A tuple of plain numbers
 *   can only be destructured once, whereas Rust's all-`Copy` tuples can be reused.
 * - JavaScript has no scope-end drop. `const [, rx] = pair` takes and discards slot 0, so if it
 *   holds a droppable value, it is never disposed. Bind every droppable value and drop the ones
 *   you do not want explicitly.
 * - A rest pattern, `const [a, ...rest] = t`, gives a plain array, not a `Tuple`.
 * - Rust tuples are mutable behind `mut`. These are always read-only.
 *
 * @param args the values, one per position. Types are inferred as a tuple of literals.
 * @returns a `Tuple<T>` holding `args`
 * @throws when an index is out of bounds, a moved or dropped slot is read, or a partially moved
 * tuple is compared or cloned
 * @example
 * ```typescript
 * const pair = Tuple("sing", 2); // Tuple<["sing", 2]>
 *
 * pair[0]; // "sing"
 * pair[0]; // "sing", index reads never move
 * pair[2]; // panics: index out of bounds: the len is 2 but the index is 2
 *
 * // destructuring moves the values out
 * const [word, count] = pair;
 * pair[0]; // panics: use of moved value
 *
 * // different types in one value, each position keeps its own
 * const conn = Tuple(new Connection(), new Socket());
 * drop(conn); // type error: Socket is async-only
 * await async_drop(conn); // disposes both, in order
 *
 * // moved-out values are not disposed again
 * const [first] = Tuple(new Connection(), new Connection());
 * drop(first); // disposes the first connection once
 * ```
 */
function Tuple<const T extends unknown[]>(...args: T): Tuple<T> {
	return new Impl(args) as unknown as Tuple<T>;
}

// Make `instanceof FixedArray` work
Object.defineProperty(Tuple, Symbol.hasInstance, {
	value(instance: any) {
		return instance instanceof Impl;
	}
});

// Prototype chain so methods are found when people look at the constructor
Tuple.prototype = Impl.prototype;

export { Tuple };

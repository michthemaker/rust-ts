# rust-ts

Rust's `std`, in TypeScript. Rust-like developer experience first, convenience second.

> **Status: paused at v0.1.0** The core below works and is tested. See [Status](#status) for what is unfinished.

```ts
const pair = Tuple(new Connection(), new Socket());

drop(pair);              // throws before disposing anything: Socket is async-only
await async_drop(pair);  // disposes both, in order, and the tuple is consumed
```

## Why

JavaScript lets you do almost anything, which is the problem. Rust's `std` is a set of
decisions about what should be hard to get wrong: `Option` instead of `null`, `Result` instead
of exceptions, one element type per collection, resources that clean up after themselves.

`rust-ts` takes those decisions seriously. Where TypeScript can enforce a rule at compile time,
it does, and the error says what to do about it. Where it can't, the rule is enforced at runtime
with a panic that reads like rustc's. Where JavaScript makes a Rust behavior impossible, the
difference is documented (see [Where it differs from Rust](#where-it-differs-from-rust)).

## What's inside

| Area | What you get |
|---|---|
| `Option`, `Result` | Classes with the Rust API, comparable with structural equality |
| `Slice`, `Vec`, `FixedArray` | Non-copying slice views, the full `Vec` API, fixed-size arrays |
| `Tuple` | Heterogeneous, per-position types, destructuring moves values out |
| `OnceLock` | Set-once cell with `Drop` support |
| Sized numbers | `u8`..`u128`, `i8`..`i128`, `usize`, `isize`, `f32`, `f64`, with compile-time range checks on literals |
| Decimals | `d32`, `d64`, `d128`: exact decimal arithmetic (no Rust equivalent, added on purpose) |
| Traits | `trait()`, `impl()`, `impls()`: nominal traits as mixins, enforced at compile time and runtime |
| Ownership | `Drop`, `AsyncDrop`, `Container`, `drop()`, `async_drop()` |
| Formatting | `println("{} {:?}", ...)` with format strings checked at compile time |
| `match` | Pattern matching helpers |
| Concurrency | `sync` (channels, `OnceLock`, semaphore) and `thread` |

## Setup

There is **no build step**: the package ships raw `.ts` source, and you opt in through your own
`tsconfig`.

<!-- TODO: add the real install command (npm / GitHub) once the package is published -->

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "allowImportingTsExtensions": true, // requires noEmit
    "noEmit": true,
    "moduleResolution": "bundler",      // or "NodeNext"
    "strict": true
  }
}
```

Without those two flags the package cannot be imported at all, so there is no half-working state.
Tested with Bun (`bun test`) and checked with `tsc` directly.

## A short tour

<!-- TODO: confirm the import paths used in these examples against the current exports -->

```ts
import { vec, FixedArray, Tuple, Option, u8, d64 } from "rust-ts/prelude";

// collections are homogeneous, like Vec<T>
const v = vec<number>();
v.push(1);
vec<number | string>();   // compile error: unions are not allowed, collections must be homogeneous

// need mixed types? use a Tuple. Each position keeps its own type
const row = Tuple("sing", 2);   // Tuple<["sing", 2]>
row[0];                         // "sing"
row[2];                         // panics: index out of bounds: the len is 2 but the index is 2

// sized numbers check literals at compile time
const a: u8 = u8.MAX;           // 255
const b: u8 = 256;              // compile error

// exact decimals, built from strings, no floating point surprises
d64("0.10").add(d64("0.20")).eq(d64("0.30"));   // true
```

## Ownership and drop

Rust drops values automatically at the end of a scope. JavaScript has no such moment, so
`rust-ts` makes the rules explicit and checks them.

```ts
class Connection extends impl(Drop) {
  [Symbol.dispose]() { /* close it */ }
}
class Socket extends impl(AsyncDrop) {
  async [Symbol.asyncDispose]() { /* close it */ }
}

drop(new Connection());          // calls [Symbol.dispose]()
await async_drop(new Socket());  // calls [Symbol.asyncDispose]()
drop(new Socket());              // compile error, and a panic at runtime: use async_drop
```

Dropping **consumes** the value: any later use panics with `use of dropped value`.

### Containers

A type that owns other values implements `Container`. `Vec`, `FixedArray`, `Tuple` and `OnceLock`
all do. In Rust this is automatic ("drop glue"); in JavaScript the marker says "my dispose
forwards to the values I own". It is also the only way to implement both `Drop` and `AsyncDrop`:
a plain class with both is a compile error, because `drop` could not tell which path to take.

| Situation | Result |
|---|---|
| Value implements `Drop` | `drop(x)` disposes it |
| Value is async-only | `drop(x)` is a type error and throws; use `async_drop` |
| Plain class with both traits | type error: remove one trait, or make it a `Container` |
| Container holding an async-only element | `drop` **refuses before disposing anything**; the container stays intact, so `async_drop` still works |
| An element's dispose throws | the rest are still dropped, the container is consumed, the error is rethrown (an `AggregateError` if several threw) |
| Dropping twice | panics: `cannot drop a dropped value` |

### Moves out of a `Tuple`

Destructuring is the move. Each slot is emptied as it is taken, and the tuple's drop skips
emptied slots, so a value you took and dropped yourself is never disposed twice.

```ts
const pair = Tuple(new Connection(), new Connection());
const [first] = pair;   // slot 0 is now moved out
drop(first);            // disposes the first connection
drop(pair);             // disposes only the second one

pair[0];                // panics: use of moved value: Tuple.0
pair.clone();           // panics: use of partially moved value
```

Index reads (`pair[1]`) never move. TypeScript cannot track moves, so this is enforced at
runtime only.

## Type-level guarantees

- **Homogeneous collections.** `Vec`, `FixedArray` and `Slice` reject union element types at
  compile time. `Option<A>` is fine; `Option<A | B>` is not. Mixed values go in a `Tuple`.
- **No promises in `OnceLock`.** Rejected by the type, and again at runtime in `set` and
  `get_or_init`. A promise cannot be cancelled or dropped, so storing one would silently leak
  whatever it resolves to. Await it and store the resolved value.
- **Traits are enforced.** `impl(Drop)` makes `[Symbol.dispose]` required, so forgetting it is a
  compile error. `impls(x, Drop)` is a nominal check at runtime.
- **Decimals track their precision.** Scale and significant digits live in the type, so a `mul`
  that provably overflows is a compile-time error.
- **Format strings are parsed by the type system.** `println("{} {:?}", a, b)` checks each
  placeholder against its argument at compile time.
- **Stale slice views are caught.** A `Slice` taken from a `Vec` throws `slice invalidated`
  after the `Vec` changes structurally. Rust's borrow checker does this at compile time; this is
  the runtime equivalent.

## Where it differs from Rust

These are deliberate, and most of them follow from JavaScript.

- **No scope-end drop.** You call `drop()` / `async_drop()` yourself. `const [, rx] = pair`
  takes slot 0 and discards it without disposing it, so bind every droppable value and drop the
  ones you do not want.
- **Moves are runtime-only**, and only `Tuple` destructuring moves. A tuple of plain numbers
  can be destructured once, where Rust's all-`Copy` tuples can be reused.
- **A rest pattern gives an array.** `const [a, ...rest] = tuple` produces a plain array, not a
  `Tuple`.
- **`FixedArray` has no `Default`.** `N` exists only in the type system and is erased at runtime,
  so there is no length to allocate. This is a hard limit, not a missing feature.
- **`Tuple` is read-only.** Rust tuples are mutable behind `mut`.
- **Panics are thrown `Error`s** with Rust-style messages.
- **Decimals, `shared_json_buffer`, `transferable` and `serializable` are additions.** Rust has
  no equivalent (floats, and passing data between workers, are not problems Rust has in the same
  form).

## Module layout

The layout mirrors Rust's `std` paths where one exists, and invents sensibly where one doesn't.

- `std` matches: `option`, `result`, `vec`, `slice`, `array`, `range`, `cmp`, `clone`, `default`,
  `ops`, `mem`, `sync`, `thread`, `fmt`
- `primitive`: re-exports the sized numbers, matching `std::primitive`
- `lang`: `match` and the trait machinery. These are Rust *syntax*, not library items, so there is
  no `std::match`. Modeled on Java's `java.lang`
- `macros`: `println`, as in `std::macros`
- `prelude` is plain re-exports with no side effects. `globals` is the separate opt-in for
  zero-import ambient globals
- Internal helpers and `*_impl` files are never exported, so they cannot be imported by accident

## Status

**Works and is tested:** `Option`, `Result`, `Slice`, `Vec`, `FixedArray`, `Tuple`, `OnceLock`,
sized numbers, decimals, the trait system, `Drop` / `AsyncDrop` / `Container`, `drop` /
`async_drop`, `println`.

**Not done:**

- `Display` trait: `{}` in `println` only accepts primitives until it exists
- Channel semantics: `Receiver.recv()` is async (tokio-style), where `std`'s blocks the thread.
  `try_recv`, `recv_timeout` and a blocking iterator are missing. The plan is a std-faithful
  blocking `recv` with an async variant and a main-thread guard
- `Tuple`'s `Clone` is unconditional; in Rust it exists only when every element is `Clone`
- A generator for the package `exports` map, so internal files stay unreachable

## Development

```sh
bun test            # run the tests
bunx tsc --noEmit   # type-check
```

Trait classes need a `declare static readonly __instance` brand so that generic traits keep
their type argument (see the docs on `trait`).

## Credits

The trait system is inspired by [traits-ts/core](https://github.com/traits-ts/core). Everything
else follows the Rust standard library documentation.

## License

MIT

import { is_thenable } from "../../lib/is_thenable.ts";
import type { DropCheck, Msg } from "../../lib/types";
import { Clone, clone_of } from "../clone.ts";
import { is_eq, PartialEq } from "../cmp.ts";
import { Default } from "../default.ts";
import { Debug, FMT, type FmtOptions } from "../fmt.ts";
import { AsyncDrop, Container, Drop } from "../ops.ts";
import { Option } from "../option.ts";
import { Result } from "../result.ts";
import { impl, impls } from "../trait_impl.ts";

type Thenable = { then: (...args: any[]) => any };

type NotThenable<T> = [T] extends [Thenable]
	? Msg<"OnceLock<T>: T cannot be a Thenable value. Await it and store the resolved value">
	: unknown;

function panic(msg: string): never {
	throw new Error(msg);
}

const EMPTY = Option.None();

export class OnceLock<T extends DropCheck<T> & NotThenable<T>> extends impl(
	PartialEq,
	Default,
	Debug,
	Drop,
	AsyncDrop,
	Clone,
	Container
) {
	#slot = EMPTY as T;
	#dropped = false;

	[FMT](
		_depth: number,
		options: FmtOptions,
		inspect: (arg: any, options: FmtOptions) => string
	): string {
		return `OnceLock(${this.#dropped ? "<dropped>" : this.#slot === EMPTY ? "Uninitialized" : inspect(this.#slot, options)})`;
	}

	get(): Option<T> {
		this.#assert_alive();
		return this.#slot === EMPTY ? Option.None() : Option.Some(this.#slot);
	}

	get_or_init(f: () => T): T {
		this.#assert_alive();
		if (this.#slot === EMPTY) {
			let v = f();
			if (is_thenable(v)) panic("initializer returned a promise: use an async OnceLock variant");
			this.#slot = v as unknown as T;
		}
		return this.#slot;
	}

	set(value: T): Result<null, T> {
		this.#assert_alive();
		if (is_thenable(value))
			panic("OnceLock cannot hold a promise: await it first, then store the resolved value");
		if (this.#slot !== EMPTY) return Result.Err(value);
		this.#slot = value;
		return Result.Ok(null);
	}

	take(): Option<T> {
		this.#assert_alive();
		let v = this.#slot;
		this.#slot = EMPTY as T;
		return v === EMPTY ? Option.None() : Option.Some(v);
	}

	#assert_alive() {
		if (this.#dropped) panic("use of dropped value: OnceLock<T>");
	}

	eq(other: OnceLock<T>): boolean {
		this.#assert_alive();
		if (other instanceof OnceLock) {
			return is_eq(this.#slot, other.get());
		} else return false;
	}

	ne(other: OnceLock<T>): boolean {
		this.#assert_alive();
		return !this.eq(other);
	}

	clone(): OnceLock<T> {
		this.#assert_alive();
		const once_lock = new OnceLock<T>();
		if (this.#slot !== EMPTY) once_lock.#slot = clone_of(this.#slot);
		return once_lock;
	}

	static default<T extends DropCheck<T> & NotThenable<T>>() {
		return new OnceLock<T>();
	}

	[Symbol.dispose]() {
		if (this.#dropped) panic("cannot drop a dropped value: OnceLock<T>");
		let v = this.#slot;
		// validate first, nothing mutated if we refuse (same rule as FixedArray)
		if (v !== EMPTY && impls(v, AsyncDrop) && !(impls(v, Drop) && impls(v, Container)))
			panic("cannot synchronously drop an asynchronous resource. Use async_drop instead.");
		this.#dropped = true;
		this.#slot = EMPTY as T; // consumed from here, even if inner throws
		if (v !== EMPTY && impls(v, Drop)) v[Symbol.dispose](); // error propagates as is (single element)
	}

	async [Symbol.asyncDispose]() {
		if (this.#dropped) panic("cannot drop a dropped value: OnceLock<T>");
		let v = this.#slot;
		this.#dropped = true;
		this.#slot = EMPTY as T; // before awaiting, so concurrent drops panic
		if (v !== EMPTY)
			if (impls(v, AsyncDrop)) await v[Symbol.asyncDispose]();
			else if (impls(v, Drop)) v[Symbol.dispose]();
	}
}

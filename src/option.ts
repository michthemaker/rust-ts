import { Clone, clone_of } from "./clone.ts";
import { is_eq, PartialEq } from "./cmp.ts";
import { Debug, FMT } from "./fmt.ts";
import { Result } from "./result.ts";
import { impl, type TraitInstance } from "./trait.ts";

export const HIDDEN_OPTION_TAG = "rust-ts::std::Option<T>";

interface OptionMethods<T>
	extends
		TraitInstance<typeof PartialEq<Option<T>>>,
		TraitInstance<typeof Clone<Option<T>>>,
		TraitInstance<typeof Debug> {
	is_some(): this is Some<T>;
	is_none(): this is None;
	unwrap(): T;
	expect(msg: string): T;
	unwrap_or(default_value: T): T;
	iter(): IterableIterator<T>;
	/**
	 * Transforms the Option<T> into a Result<T, E>, mapping Some(v) to Ok(v) and None to Err(err).
	 */
	ok_or<E>(err: E): Result<T, E>;
	/**
	 * Transforms the Option<T> into a Result<T, E>, mapping Some(v) to Ok(v) and None to Err(err()).
	 */
	ok_or_else<E>(err: () => E): Result<T, E>;
}

export interface Some<T> extends OptionMethods<T> {}

export interface None<T = unknown> extends OptionMethods<T> {}

export type Option<T> = Some<T> | None<T>;

class OptionImpl<T> extends impl(PartialEq<any>, Debug, Clone) implements OptionMethods<T> {
	private some: boolean;
	private value: T | undefined;
	[HIDDEN_OPTION_TAG] = true;
	[FMT](_depth: number, options: any, inspect: Function) {
		if (this.is_some()) {
			return `Some(${inspect(this.value, options)})`;
		} else {
			return "None";
		}
	}
	constructor(some: boolean, value: any) {
		super();
		this.some = some;
		if (some === true) this.value = value;
		Object.freeze(this);
	}

	is_some(): this is Some<T> {
		return this.some;
	}
	is_none(): this is None {
		return !this.some;
	}
	*iter() {
		if (this.is_some()) {
			yield this.unwrap();
		}
	}
	unwrap(): T {
		if (!this.some) throw new Error("called `Option::unwrap()` on a `None` value");
		// @ts-ignore
		return this.value;
	}
	expect(msg: string): T {
		if (!this.some) throw new Error(msg);
		// @ts-ignore
		return this.value;
	}
	unwrap_or(default_value: T): T {
		// @ts-ignore
		return this.some ? this.value : default_value;
	}
	ok_or<E>(err: E) {
		return this.some ? Result.Ok(this.value!) : Result.Err(err);
	}
	ok_or_else<E>(f: () => E) {
		return this.some ? Result.Ok(this.value!) : Result.Err(f());
	}
	eq(other: unknown): boolean {
		if (Option.is_option(other)) {
			if (other.is_some() && this.is_some() && is_eq(other.unwrap(), this.value)) return true;
			else if (other.is_none() && this.is_none()) return true;
			return false;
		} else return false;
	}
	ne(other: unknown): boolean {
		return !this.eq(other);
	}
	clone() {
		return create_frozen_option({ some: this.some, value: clone_of(this.value) }) as Option<T>;
	}
}

function create_frozen_option<T>(raw: any): Option<T> {
	const option_obj = new OptionImpl(
		raw.some,
		raw.some === true ? raw.value : undefined
	) as unknown as Option<T>;

	return Object.freeze(option_obj) as unknown as Option<T>;
}

export const Option = {
	Some<T>(value: T): Option<T> {
		return create_frozen_option({ some: true, value });
	},
	None(): Option<never> {
		return create_frozen_option({ some: false });
	},
	from<T>(value: Option<T>) {
		return create_frozen_option(value);
	},
	is_option(value: unknown): value is Option<unknown> {
		return typeof value === "object" && value !== null && HIDDEN_OPTION_TAG in value;
	},
	is_none(value: any) {
		// @ts-ignore
		return value === null || value === undefined || Number.isNaN(value);
	},
	is_some(value: any) {
		return !Option.is_none(value);
	}
};

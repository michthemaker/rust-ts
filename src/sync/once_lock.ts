import { Clone, clone_of } from "../clone.ts";
import { is_eq, PartialEq } from "../cmp.ts";
import { Default } from "../default.ts";
import { Debug, FMT, type FmtOptions } from "../fmt.ts";
import { Result } from "../result.ts";
import { impl } from "../lang/index.ts";

class OnceLock<T> extends impl(PartialEq, Default, Debug, Clone) {
	#value: T | null = null;
	#locked: boolean = false;

	[FMT](
		_depth: number,
		options: FmtOptions,
		inspect: (arg: any, options: FmtOptions) => string
	): string {
		return `OnceLock(${!this.#locked ? "Uninitialized" : inspect(this.#value, options)})`;
	}

	get() {
		return this.#value;
	}

	set(initial: T): Result<null, string> {
		if (this.#locked) return Result.Err("This OnceLock has already been initiliazed.");
		else {
			this.#value = initial;
			this.#locked = true;
			return Result.Ok(null);
		}
	}

	eq(other: OnceLock<T>): boolean {
		if (other instanceof OnceLock) {
			return is_eq(this.#value, other.get());
		} else return false;
	}

	ne(other: OnceLock<T>): boolean {
		return !this.eq(other);
	}

	clone(): OnceLock<T> {
		const once_lock = new OnceLock<T>();
		once_lock.#locked = this.#locked;
		if (this.#locked === true) once_lock.#value = clone_of(this.#value);
		return once_lock;
	}

	static default<T>() {
		return new OnceLock<T>();
	}
}

export { OnceLock };

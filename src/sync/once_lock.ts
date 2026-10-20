import { is_eq, PartialEq } from "../cmp/partial_eq.ts";
import { Debug, FMT, FmtOptions } from "../fmt.ts";
import { Result } from "../result.ts";
import { impl } from "../trait.ts";

class OnceLock<T> extends impl(PartialEq, Debug) {
  #value: T | null = null;
  #is_locked: boolean = false;

  [FMT](
    _depth: number,
    options: FmtOptions,
    inspect: (arg: any, options: FmtOptions) => string,
  ): string {
    return `OnceLock(${!this.#is_locked ? "Uninitialized" : inspect(this.#value, options)})`;
  }

  get() {
    return this.#value;
  }

  set(initial: T): Result<null, string> {
    if (this.#is_locked) return Result.Err("This OnceLock has already been initiliazed.");
    else {
      this.#value = initial;
      this.#is_locked = true;
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
}

export { OnceLock };

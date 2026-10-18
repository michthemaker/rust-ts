import { is_equal, PartialEq } from "../cmp/partial_eq.ts";
import { Result } from "../result.ts";

class OnceLock<T> implements PartialEq<OnceLock<T>> {
  private value: T | null = null;
  private is_locked: boolean = false;

  get() {
    return this.value;
  }

  set(initial: T): Result<null, string> {
    if (this.is_locked) return Result.Err("This OnceLock has already been initiliazed.");
    else {
      this.value = initial;
      this.is_locked = true;
      return Result.Ok(null);
    }
  }

  eq(other: unknown): boolean {
    if (other instanceof OnceLock) {
      return is_equal(this.value, other.get());
    } else return false;
  }

  ne(other: unknown): boolean {
    return !this.eq(other);
  }
}

export { OnceLock };

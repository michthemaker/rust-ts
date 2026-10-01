import { Result } from "./result.ts";

class OnceLock<T> {
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
}

export { OnceLock };

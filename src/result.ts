import { is_eq, PartialEq } from "./cmp/partial_eq";
import { Debug, FMT } from "./fmt";
import { Option } from "./option";
import { impl, TraitInstance } from "./trait";

export const HIDDEN_RESULT_TAG = "rust-ts::std::Result<T, E>";

interface ResultMethods<T, E> extends TraitInstance<typeof PartialEq<Result<T, E>>> {
  is_ok(): this is Ok<T, E>;
  is_err(): this is Err<T, E>;
  unwrap(): T;
  expect(msg: string): T;
  unwrap_or(default_value: T): T;
  unwrap_err(): E;
  expect_err(msg: string): E;
  iter(): IterableIterator<Option<T>>;
  /**
   * Converts from Result<T, E> to Option<T>.
   * Converts self into an Option<T>, and converting the error to None, if any.
   */
  ok(): Option<T>;
  /**
   * Converts from Result<T, E> to Option<E>.
   * Converts self into an Option<E>, and discarding the success value, if any.
   */
  err(): Option<E>;
}

// @ts-ignore
export interface Ok<T, E> extends ResultMethods<T, E> {}

export interface Err<T, E> extends ResultMethods<T, E> {}

export type Result<T, E> = Ok<T, E> | Err<T, E>;

class ResultImpl<T, E> extends impl(PartialEq<any>, Debug) implements ResultMethods<T, E> {
  // we will leave these as private so that equality checkers can work
  private result_ok: boolean;
  private value: T | undefined;
  private error: E | undefined;
  [HIDDEN_RESULT_TAG] = true;
  constructor(ok: boolean, value_or_error: any) {
    super();
    this.result_ok = ok;
    if (ok === true) this.value = value_or_error;
    else this.error = value_or_error;
    Object.freeze(this);
  }
  [FMT](_depth: number, options: any, inspect: Function) {
    if (this.is_ok()) {
      return `Ok(${inspect(this.value, options)})`;
    } else {
      // @ts-ignore
      return `Err(${inspect(this.error, options)})`;
    }
  }
  is_ok(): this is Ok<T, E> {
    return this.result_ok;
  }
  is_err(): this is Err<T, E> {
    return !this.result_ok;
  }
  *iter() {
    if (this.is_ok() as unknown as Ok<T, E>) {
      yield Option.Some(this.unwrap());
    } else yield Option.None();
  }
  unwrap(): T {
    if (!this.result_ok) throw new Error(String(this.error));
    return this.value!;
  }
  expect(msg: string): T {
    if (!this.result_ok) throw new Error(`${msg}: ${this.error}`);
    return this.value!;
  }
  unwrap_or(default_value: T): T {
    return this.result_ok ? this.value! : default_value;
  }
  unwrap_err(): E {
    if (this.result_ok) throw new Error(String(this.value));
    return this.error!;
  }
  expect_err(msg: string): E {
    if (this.result_ok) throw new Error(`${msg}: ${this.value}`);
    return this.error!;
  }
  ok(): Option<T> {
    return this.result_ok === true ? Option.Some(this.value!) : Option.None();
  }
  err(): Option<E> {
    return this.result_ok === false ? Option.Some(this.error!) : Option.None();
  }
  eq(other: unknown): boolean {
    if (Result.is_result(other)) {
      if (other.is_ok() && this.is_ok() && is_eq(other.unwrap(), this.value)) return true;
      else if (other.is_err() && this.is_err() && is_eq(other.unwrap_err(), this.error))
        return true;
      return false;
    } else return false;
  }
  ne(other: unknown): boolean {
    return !this.eq(other);
  }
}

function createFrozenResult<T, E>(raw: any): Result<T, E> {
  const result_obj = new ResultImpl<T, E>(
    raw.ok,
    raw.ok ? raw.value : raw.error,
  ) as unknown as Result<T, E>;

  return Object.freeze(result_obj) as unknown as Result<T, E>;
}

export const Result = {
  Ok<T = any, E = any>(value: T): Result<T, E> {
    return createFrozenResult({ ok: true, value });
  },
  Err<T = any, E = any>(error: E): Result<T, E> {
    return createFrozenResult({ ok: false, error });
  },
  from<T, E>(value: Result<T, E>) {
    return createFrozenResult(value);
  },
  is_result(value: unknown): value is Result<unknown, unknown> {
    return typeof value === "object" && value !== null && HIDDEN_RESULT_TAG in value;
  },
};

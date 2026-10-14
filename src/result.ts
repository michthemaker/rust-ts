import { Option } from "./option";

export const HIDDEN_RESULT_TAG = "rust-ts::std::Result<T, E>";

interface ResultMethods<T, E> {
  is_ok(): this is Ok<T, E>;
  is_err(): this is Err<T, E>;
  unwrap(): T;
  expect(msg: string): T;
  unwrap_or(default_value: T): T;
  iter(): IterableIterator<Option<T>>;
}

// @ts-ignore
export interface Ok<T, E> extends ResultMethods<T, E> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<T, E> extends ResultMethods<T, E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T, E> | Err<T, E>;

const DEBUG = Symbol.for("nodejs.util.inspect.custom");

class ResultImpl<T, E> implements ResultMethods<T, E> {
  private ok: boolean;
  [HIDDEN_RESULT_TAG] = true;
  constructor(ok: boolean, value_or_error: any) {
    this.ok = ok;
    if (ok === true)
      // @ts-ignore
      this.value = value_or_error;
    // @ts-ignore
    else this.error = value_or_error;
  }
  // @ts-ignore
  [DEBUG](_depth: number, options: any, inspect: Function) {
    if (this.is_ok()) {
      // @ts-ignore
      return `Ok(${inspect(this.value, options)})`;
    } else {
      // @ts-ignore
      return `Err(${inspect(this.error, options)})`;
    }
  }
  is_ok(): this is Ok<T, E> {
    return this.ok;
  }
  is_err(): this is Err<T, E> {
    return !this.ok;
  }
  *iter() {
    if (this.is_ok() as unknown as Ok<T, E>) {
      yield Option.Some(this.unwrap());
    } else yield Option.None();
  }
  unwrap(): T {
    if (!this.ok) throw new Error(`called \`Result::unwrap()\` on an \`Err\``);
    // @ts-ignore
    return this.value;
  }
  expect(msg: string): T {
    if (!this.ok) throw new Error(msg);
    // @ts-ignore
    return this.value;
  }
  unwrap_or(default_value: T): T {
    // @ts-ignore
    return this.ok ? this.value : default_value;
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

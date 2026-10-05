import { Option } from "./option";

export const HIDDEN_RESULT_TAG = "rust-ts::std::Result";

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

function createFrozenResult<T, E>(raw: any): Result<T, E> {
  const resultObj = {
    ok: raw.ok,
    ...(raw.ok ? { value: raw.value } : { error: raw.error }),
    // @ts-ignore
    [HIDDEN_RESULT_TAG]: true,
    is_ok(): this is Ok<T, E> {
      return this.ok;
    },
    is_err(): this is Err<T, E> {
      return !this.ok;
    },
    *iter() {
      if (this.is_ok()) {
        yield Option.Some(this.unwrap());
      } else yield Option.None();
    },
    unwrap(): T {
      if (!this.ok) throw new Error(`called \`Result::unwrap()\` on an \`Err\``);
      // @ts-ignore
      return this.value;
    },
    expect(msg: string): T {
      if (!this.ok) throw new Error(msg);
      // @ts-ignore
      return this.value;
    },
    unwrap_or(default_value: T): T {
      // @ts-ignore
      return this.ok ? this.value : default_value;
    },
  } satisfies Result<T, E>;

  return Object.freeze(resultObj) as unknown as Result<T, E>;
}

export const Result = {
  Ok<T, E = any>(value: T): Result<T, E> {
    return createFrozenResult({ ok: true, value });
  },
  Err<T, E = any>(error: E): Result<T, E> {
    return createFrozenResult({ ok: false, error });
  },
  from<T, E>(value: Result<T, E>) {
    return createFrozenResult(value);
  },
  is_result(value: unknown): value is Result<unknown, unknown> {
    return typeof value === "object" && value !== null && HIDDEN_RESULT_TAG in value;
  },
};

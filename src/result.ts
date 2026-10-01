export const HIDDEN_RESULT_TAG = "__INTERNAL_RUST_RESULT_BRAND_74x92__";

interface ResultMethods<T, E> {
  is_ok(): this is Ok<T, E>;
  is_err(): this is Err<T, E>;
  unwrap(): T;
  expect(msg: string): T;
  unwrap_or(default_value: T): T;
  iter(): IterableIterator<T>;
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
    // Conditionally attach value/error based on status
    ...(raw.ok ? { value: raw.value } : { error: raw.error }),
    // Inject hidden tag for our type guards
    [HIDDEN_RESULT_TAG]: true,

    is_ok() {
      return this.ok;
    },
    is_err() {
      return !this.ok;
    },
    *iter() {
      if (this.is_ok()) {
        yield this.unwrap();
      }
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
  };

  return Object.freeze(resultObj) as unknown as Result<T, E>;
}

export const Result = {
  Ok<T, E = any>(value: T): Result<T, E> {
    return createFrozenResult({ ok: true, value });
  },
  Err<E, T = any>(error: E): Result<T, E> {
    return createFrozenResult({ ok: false, error });
  },
  match<T, E, U>(
    result: Result<T, E>,
    {
      Ok,
      Err,
    }: {
      Ok: (val: T) => U;
      Err: (err: E) => U;
    },
  ): U {
    if (result.is_ok()) return Ok?.(result.value);
    else return Err?.(result.error);
  },
  from<T, E>(value: Result<T, E>) {
    return createFrozenResult(value);
  },
  is_result(value: unknown): value is Result<unknown, unknown> {
    return typeof value === "object" && value !== null && HIDDEN_RESULT_TAG in value;
  },
};

export const HIDDEN_OPTION_TAG = "rust-ts::std::Option<T>";

interface OptionMethods<T> {
  is_some(): this is Some<T>;
  is_none(): this is None;
  unwrap(): T;
  expect(msg: string): T;
  unwrap_or(default_value: T): T;
  iter(): IterableIterator<T>;
}

export interface Some<T> extends OptionMethods<T> {}

export interface None<T = unknown> extends OptionMethods<T> {}

export type Option<T> = Some<T> | None<T>;

const DEBUG = Symbol.for("nodejs.util.inspect.custom");

class OptionImpl<T> implements OptionMethods<T> {
  private some: boolean;
  private value: T | undefined;
  [HIDDEN_OPTION_TAG] = true;
  [DEBUG](_depth: number, options: any, inspect: Function) {
    if (this.is_some()) {
      return `Some(${inspect(this.value, options)})`;
    } else {
      return "None";
    }
  }
  constructor(some: boolean, value: any) {
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
}

function create_frozen_option<T>(raw: any): Option<T> {
  const option_obj = new OptionImpl(
    raw.some,
    raw.some === true ? raw.value : undefined,
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
  },
};

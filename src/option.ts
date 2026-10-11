export const HIDDEN_OPTION_TAG = "rust-ts::std::Option<T>";

interface OptionMethods<T> {
  is_some(): this is Some<T>;
  is_none(): this is None;
  unwrap(): T;
  expect(msg: string): T;
  unwrap_or(default_value: T): T;
  iter(): IterableIterator<T>;
}

export interface Some<T> extends OptionMethods<T> {
  readonly value: T;
}

export interface None<T = unknown> extends OptionMethods<T> {}

export type Option<T> = Some<T> | None<T>;

const DEBUG = Symbol.for("nodejs.util.inspect.custom");

function createFrozenOption<T>(raw: any): Option<T> {
  const optionObj = {
    some: raw.some,
    ...(raw.some ? { value: raw.value } : {}),
    [HIDDEN_OPTION_TAG]: true,
    [DEBUG](_depth: number, options: any, inspect: Function) {
      if (this.is_some()) {
        return `Some(${inspect(this.value, options)})`;
      } else {
        return "None";
      }
    },
    is_some() {
      return this.some;
    },
    is_none() {
      return !this.some;
    },
    *iter() {
      if (this.is_some()) {
        yield this.unwrap();
      }
    },
    unwrap(): T {
      if (!this.some) throw new Error("called `Option::unwrap()` on a `None` value");
      return this.value;
    },
    expect(msg: string): T {
      if (!this.some) throw new Error(msg);
      return this.value;
    },
    unwrap_or(default_value: T): T {
      return this.some ? this.value : default_value;
    },
  };

  return Object.freeze(optionObj) as unknown as Option<T>;
}

export const Option = {
  Some<T>(value: T): Option<T> {
    return createFrozenOption({ some: true, value });
  },
  None(): Option<never> {
    return createFrozenOption({ some: false });
  },
  from<T>(value: Option<T>) {
    return createFrozenOption(value);
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

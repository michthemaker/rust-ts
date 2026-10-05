import { is_equal } from "../lib/is_equal";
import { Option } from "./option";
import { Result } from "./result";

const SECRETE_METADATA_REGISTRY = new WeakMap();

Object.defineProperty(Symbol.prototype, "metadata", {
  get() {
    //'this' refers to the primitive symbol being inspected!
    return SECRETE_METADATA_REGISTRY.get(this);
  },
  set(value) {
    SECRETE_METADATA_REGISTRY.set(this, value);
  },
  configurable: true,
});

const SYMBOL_WILDCARD = Symbol("Wildcard");

const Pattern = {
  Some<T>(val: T) {
    const sym = Symbol(`SomeLiteral`);
    // @ts-ignore
    sym.metadata = {
      value: Option.Some(val),
    };
    return sym;
  },
  Err<E>(val: E) {
    const sym = Symbol(`ErrLiteral`);
    // @ts-ignore
    sym.metadata = {
      value: Result.Err(val),
    };
    return sym;
  },
  Ok<T>(val: T) {
    const sym = Symbol(`OkLiteral`);
    // @ts-ignore
    sym.metadata = {
      value: Result.Ok(val),
    };
    return sym;
  },
  Val<T>(val: T) {
    const sym = Symbol(`ValLiteral`);
    // @ts-ignore
    sym.metadata = {
      type: "Val",
      value: val,
    };
    return sym;
  },
  _: SYMBOL_WILDCARD,
};

type ResultVariants<T, E, U> = {
  Ok: (val: T) => U;
  Err: (err: E) => U;
  [pattern: symbol]: (val: T) => U;
};

type OptionVariants<T, U> = {
  Some: (val: T) => U;
  None: () => U;
  [pattern: symbol]: (val: T) => U;
};

type LiteralVariants<T, U> = {
  [K in string | number | symbol]: K extends symbol ? (val: T) => U : () => U;
};

function match<T, E, U>(value: Result<T, E>, match_expr: ResultVariants<T, E, U>): U;

function match<T, U>(value: Option<T>, match_expr: OptionVariants<T, U>): U;

function match<T, U>(value: T, match_expr: LiteralVariants<T, U>): U;

function match(value: any, config: any) {
  // handle [Pattern.*]
  for (const symbol_key of Object.getOwnPropertySymbols(config)) {
    if (symbol_key === SYMBOL_WILDCARD) continue;
    const metadata = (symbol_key as any).metadata;
    if (!metadata) continue;

    if (metadata.type === "Val") {
      if (is_equal(metadata.value, value)) {
        return config[symbol_key](value);
      }
    }

    const hidden_symbol_value = metadata.value;
    // handle Result.Ok or Result.Err
    if (Result.is_result(hidden_symbol_value) && Result.is_result(value))
      // if the hidden value and the value are of same variant and have same value return this branch
      if (
        hidden_symbol_value.is_ok() &&
        value.is_ok() &&
        is_equal(hidden_symbol_value.value, value.value)
      ) {
        return config[symbol_key](value.value);
      } else if (
        hidden_symbol_value.is_err() &&
        value.is_err() &&
        is_equal(hidden_symbol_value.error, value.error)
      )
        return config[symbol_key](value.error);

    // handle Option.Some
    if (Option.is_option(hidden_symbol_value) && Option.is_option(value)) {
      // if the hidden value and the value are of same variant and have same value return this branch
      if (
        hidden_symbol_value.is_some() &&
        value.is_some() &&
        is_equal(hidden_symbol_value.value, value.value)
      )
        return config[symbol_key](value.value);
    }
  }

  // handle Result.Ok or Result.Err
  if (Result.is_result(value)) {
    const { Ok, Err } = config as ResultVariants<unknown, unknown, unknown>;

    // Explicit exhaustive match rules validation
    if (value.is_ok()) {
      if (typeof Ok === "function") return Ok(value.value);
    } else {
      if (typeof Err === "function") return Err(value.error);
    }

    // If it missed the standard fields, check for a wildcard arm
    if (config[SYMBOL_WILDCARD] !== undefined) return config[SYMBOL_WILDCARD](value);

    // Exact compilation-emulation error triggers
    if (Option.is_none(Ok)) throw new Error(`non-exhaustive patterns: \`Ok(_)\` not covered`);
    if (Option.is_none(Err)) throw new Error(`non-exhaustive patterns: \`Err(_)\` not covered`);
    return value.is_ok() ? Ok(value.value) : Err(value.error);
  }

  // handle Option.Some or Option.None
  else if (Option.is_option(value)) {
    const { Some, None } = config as OptionVariants<unknown, unknown>;

    if (value.is_some()) {
      if (typeof Some === "function") return Some(value.value);
    } else {
      if (typeof None === "function") return None();
    }

    if (config[SYMBOL_WILDCARD] !== undefined) return config[SYMBOL_WILDCARD](value);

    if (Option.is_none(Some)) throw new Error(`non-exhaustive patterns: \`Some(_)\` not covered`);
    if (Option.is_none(None)) throw new Error(`non-exhaustive patterns: \`None()\` not covered`);
  }

  // handles the value itself and the wildcard
  if (Option.is_some(value)) {
    if (config[value] !== undefined) return config[value]();
    if (config[SYMBOL_WILDCARD] !== undefined) return config[SYMBOL_WILDCARD]();
  }

  throw new Error(
    `non-exhaustive patterns: \`[Pattern._]\` not covered\ntip: add \`[Pattern._]() {}\``,
  );
}

export { match, Pattern };

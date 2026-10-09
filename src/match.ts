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

export type Pat<Kind extends string> = symbol & {
  readonly __kind: Kind;
};

const SYMBOL_WILDCARD = Symbol("Wildcard") as unknown as Pat<"rust-ts::std::match::Wildcard">;

// kind name -> tuple of args the arm receives, or never if the kind doesn't apply to T
export interface PatternKinds<T> {
  "rust-ts::std::match::Val<T>": [];
}

export interface PatternInterface {
  _: typeof SYMBOL_WILDCARD;
  Val<T>(expected: T): Pat<"rust-ts::std::match::Val<T>">;
  Some<T>(expected: T): Pat<"rust-ts::std::Some<T>">;
  Ok<T>(expected: T): Pat<"rust-ts::std::Ok<T, E>">;
  Err<T>(expected: T): Pat<"rust-ts::std::Err<T, E>">;
}

type Validator = (subject: unknown) => Option<unknown[]>;

export function define_pattern<K extends string>(label: K, validate: Validator): Pat<K> {
  const sym = Symbol(label);
  // @ts-ignore
  sym.metadata = { validate };
  return sym as any;
}

// @ts-ignore
const Pattern: PatternInterface = {
  Val(val) {
    return define_pattern("rust-ts::std::match::Val<T>", (s) =>
      is_equal(val, s) ? Option.Some([]) : Option.None(),
    );
  },
  _: SYMBOL_WILDCARD,
  Some(val) {
    return define_pattern("rust-ts::std::Some<T>", (s) =>
      Option.is_option(s) && s.is_some() && is_equal(val, s.value)
        ? Option.Some([s.value])
        : Option.None(),
    );
  },
  Ok(val) {
    return define_pattern("rust-ts::std::Ok<T, E>", (s) =>
      Result.is_result(s) && s.is_ok() && is_equal(val, s.value)
        ? Option.Some([s.value])
        : Option.None(),
    );
  },
  Err(val) {
    return define_pattern("rust-ts::std::Err<T, E>", (s) =>
      Result.is_result(s) && s.is_err() && is_equal(val, s.error)
        ? Option.Some([s.error])
        : Option.None(),
    );
  },
};

type ResultArms<T, E, U> = {
  Ok: (val: T) => U;
  Err: (err: E) => U;
} & {
  [K in Pat<"rust-ts::std::Ok<T, E>">]: (v: T) => U;
} & {
  [K in Pat<"rust-ts::std::Err<T, E>">]: (e: E) => U;
} & {
  [K in typeof SYMBOL_WILDCARD]: () => U;
};

type OptionArms<T, U> = {
  Some: (val: T) => U;
  None: () => U;
} & {
  [K in Pat<"rust-ts::std::Some<T>">]: (v: T) => U;
} & {
  [K in typeof SYMBOL_WILDCARD]: () => U;
};

type Loose = { [k: symbol & { readonly __loose: true }]: any };

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

type PatternArms<T, U> = UnionToIntersection<
  {
    [K in keyof PatternKinds<T>]: [PatternKinds<T>[K]] extends [never]
      ? never
      : { [P in Pat<K & string>]: (...args: Extract<PatternKinds<T>[K], unknown[]>) => U };
  }[keyof PatternKinds<T>]
> & { [K in typeof SYMBOL_WILDCARD]: () => U };

function match<T, E, U>(value: Result<T, E>, match_expr: ResultArms<T, E, U> | Loose): U;

function match<T, U>(value: Option<T>, match_expr: OptionArms<T, U> | Loose): U;

function match<T, U>(value: T, match_expr: PatternArms<T, U> | Loose): U;

function match(value: any, config: any) {
  // handle [Pattern.*]
  for (const key of Object.getOwnPropertySymbols(config)) {
    if (key === (SYMBOL_WILDCARD as symbol)) continue;
    const validate = (key as any).metadata?.validate;
    if (!validate) continue;
    const result = validate(value);
    if (result.is_some()) return config[key](...result.unwrap());
  }
  // handle Result.Ok or Result.Err
  if (Result.is_result(value)) {
    const { Ok, Err } = config as ResultArms<unknown, unknown, unknown>;

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
    const { Some, None } = config as OptionArms<unknown, unknown>;

    if (value.is_some()) {
      if (typeof Some === "function") return Some(value.value);
    } else {
      if (typeof None === "function") return None();
    }

    if (config[SYMBOL_WILDCARD] !== undefined) return config[SYMBOL_WILDCARD](value);

    if (Option.is_none(Some)) throw new Error(`non-exhaustive patterns: \`Some(_)\` not covered`);
    if (Option.is_none(None)) throw new Error(`non-exhaustive patterns: \`None()\` not covered`);
  }

  // Handles the wildcard last else throws an error
  if (config[SYMBOL_WILDCARD] !== undefined) return config[SYMBOL_WILDCARD]();
  else
    throw new Error(
      `non-exhaustive patterns: \`[Pattern._]\` not covered\ntip: add \`[Pattern._]() {}\``,
    );
}

export { match, Pattern, Pattern as P };

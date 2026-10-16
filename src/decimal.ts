import { Prettify } from "../lib/types";
import type { Chars } from "./numbers";
import { Result } from "./result";

// A decimal is a whole number (the mantissa) and a `scale` (digits after the point):
// value = mantissa / 10^scale, the same model as the rust_decimal crate. The scale is
// part of the value, so "0.10000" keeps its five places and prints back as "0.10000".
// The mantissa is a private field of DecimalImpl, so it is not part of the public API.
//
// Decimals are built from strings. A JS number cannot hold trailing zeros (0.10000 is
// just 0.1) and is already a binary approximation by the time we would see it.
//
// A decimal is an opaque object, not a string, so that operators do not work on it:
// TS rejects `a + b`, and at runtime every operator throws (see Symbol.toPrimitive).

export type DecimalKind = "d32" | "d64" | "d128";

export interface Decimal<K extends DecimalKind = DecimalKind, S extends number = number> {
  readonly kind: K;
  /** how many digits come after the point: "-1.50" has scale 2 */
  readonly scale: S;
  /** always keeps the scale, e.g. "1.50" */
  to_string(): string;
  /** a string, never a JSON number, so the exact value survives JSON.stringify */
  toJSON(): string;
}

export interface d32<S extends number = number> extends Prettify<Decimal<"d32", S>> {}
export interface d64<S extends number = number> extends Prettify<Decimal<"d64", S>> {}
export interface d128<S extends number = number> extends Prettify<Decimal<"d128", S>> {}

// digits = significant digits, scale = digits after the point. Both limits apply on their
// own, and the scale cap equals the digit cap, the same relationship rust_decimal has
// (28 places, 28 digits). Leading zeros after the point are not significant, so
// "0.0000000000000000000000000001" is 1 digit with scale 28. d128 mirrors rust_decimal;
// the sizes of d32 and d64 are our own.
type Limits = { readonly digits: number; readonly scale: number };
const D32_LIMITS = { digits: 8, scale: 8 } as const;
const D64_LIMITS = { digits: 16, scale: 16 } as const;
const D128_LIMITS = { digits: 28, scale: 28 } as const;

// ------------------------------------------------------------------- types
// The literal is checked while compiling, the same way InRange checks integers.
// Number literals could not do this (1.0 and 1 are the same number), strings can.

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type AllDigits<S extends string> = S extends ""
  ? true
  : S extends `${Digit}${infer R}`
    ? AllDigits<R>
    : false;

type StripZeros<S extends string> = S extends `0${infer R}` ? StripZeros<R> : S;

type Tup<N extends number, A extends 0[] = []> = A["length"] extends N ? A : Tup<N, [...A, 0]>;

// S has at most N characters
type LenLte<S extends string, N extends number> =
  Tup<N> extends [...Chars<S>, ...unknown[]] ? true : false;

type Unsigned<S extends string> = S extends `-${infer B}` ? B : S;

// integer part: "0" or digits without a leading zero. fraction part: at least one digit.
type ShapeOk<I extends string, F extends string> = I extends ""
  ? false
  : F extends ""
    ? false
    : AllDigits<I> extends true
      ? AllDigits<F> extends true
        ? I extends "0"
          ? true
          : I extends `0${string}`
            ? false
            : true
        : false
      : false;

type BadFormat =
  'invalid decimal literal: use digits, a ".", then at least one digit, like "1.50" (no exponent, no "+", no leading zeros)';
type TooManyPlaces = "too many decimal places for this decimal type";
type TooManyDigits = "too many significant digits for this decimal type";

/** S itself when it is a valid literal, otherwise an error message (which TS then shows). */
type DecimalArg<S extends string, L extends Limits> = string extends S
  ? S // not a literal: checked at runtime
  : Unsigned<S> extends `${infer I}.${infer F}`
    ? ShapeOk<I, F> extends true
      ? LenLte<F, L["scale"]> extends true
        ? LenLte<StripZeros<`${I}${F}`>, L["digits"]> extends true
          ? S
          : TooManyDigits
        : TooManyPlaces
      : BadFormat
    : BadFormat;

/** the scale written in the literal: "0.10000" gives 5 */
type ScaleOf<S extends string> = string extends S
  ? number
  : S extends `${string}.${infer F}`
    ? Chars<F>["length"]
    : number;

interface DecimalType<K> {
  /** true if the string is a valid literal for this type: format, digit and scale limits. */
  is(s: string): boolean;
  /** Ok(decimal) with the scale kept, or Err(why) if the string is not a valid literal. */
  try_from(s: string): Result<K, string>;
}

export interface D32 extends Prettify<DecimalType<d32>> {
  <const S extends string>(s: DecimalArg<S, typeof D32_LIMITS>): d32<ScaleOf<S>>;
}
export interface D64 extends Prettify<DecimalType<d64>> {
  <const S extends string>(s: DecimalArg<S, typeof D64_LIMITS>): d64<ScaleOf<S>>;
}
export interface D128 extends Prettify<DecimalType<d128>> {
  <const S extends string>(s: DecimalArg<S, typeof D128_LIMITS>): d128<ScaleOf<S>>;
}

// ----------------------------------------------------------------- runtime

const DEBUG: unique symbol = Symbol.for("nodejs.util.inspect.custom");

class DecimalImpl<K extends DecimalKind, S extends number> implements Decimal<K, S> {
  /** the digits as a signed whole number: "-1.50" has mantissa -150n */
  readonly #mantissa: bigint;

  constructor(
    readonly kind: K,
    mantissa: bigint,
    readonly scale: S,
  ) {
    this.#mantissa = mantissa;
    Object.freeze(this);
  }

  to_string(): string {
    const negative = this.#mantissa < 0n;
    const digits = (negative ? -this.#mantissa : this.#mantissa).toString();
    const sign = negative ? "-" : "";
    if (this.scale === 0) return sign + digits;
    const padded = digits.padStart(this.scale + 1, "0");
    const split = padded.length - this.scale;
    return `${sign}${padded.slice(0, split)}.${padded.slice(split)}`;
  }

  toJSON(): string {
    return this.to_string();
  }

  // Only the "string" hint (template literals, String(x)) works. Everything else
  // (a + b, a < b, Number(a), a + "") throws, so a decimal never turns into a number
  // or gets glued onto a string by accident.
  [Symbol.toPrimitive](hint: string): string {
    if (hint === "string") return this.to_string();
    throw new TypeError(
      `a ${this.kind} cannot be used with operators or as a number; use its methods, or to_string()`,
    );
  }

  [DEBUG](): string {
    return `${this.kind}(${this.to_string()})`;
  }
}

const LITERAL = /^(-?)(0|[1-9][0-9]*)\.([0-9]+)$/;

function parse_decimal<K extends DecimalKind>(
  kind: K,
  limits: Limits,
  s: unknown,
): Result<Decimal<K>, string> {
  if (typeof s !== "string") return Result.Err(`expected a string for ${kind}, got ${typeof s}`);
  const match = LITERAL.exec(s);
  if (!match)
    return Result.Err(
      `invalid decimal literal for ${kind}: ${JSON.stringify(s)} (expected digits, a ".", then digits, like "1.50")`,
    );
  const [, sign, int, frac] = match;
  if (frac.length > limits.scale)
    return Result.Err(
      `literal out of range for ${kind}: ${s} (at most ${limits.scale} decimal places)`,
    );
  // leading zeros are not significant: "0.0012" has 2 digits. zero counts as 1.
  const digits = (int + frac).replace(/^0+/, "").length || 1;
  if (digits > limits.digits)
    return Result.Err(
      `literal out of range for ${kind}: ${s} (at most ${limits.digits} significant digits)`,
    );
  const magnitude = BigInt(int + frac);
  return Result.Ok<Decimal<K>, string>(
    new DecimalImpl(kind, sign === "-" ? -magnitude : magnitude, frac.length),
  );
}

function decimal_type<K extends DecimalKind>(kind: K, limits: Limits) {
  const construct = (s: string): Decimal<K> => {
    const parsed = parse_decimal(kind, limits, s);
    if (parsed.is_err()) throw new Error(parsed.error);
    return parsed.value;
  };
  return Object.assign(construct, {
    is: (s: string): boolean => parse_decimal(kind, limits, s).is_ok(),
    try_from: (s: string): Result<Decimal<K>, string> => parse_decimal(kind, limits, s),
  });
}

export const d32 = decimal_type("d32", D32_LIMITS) as D32;
export const d64 = decimal_type("d64", D64_LIMITS) as D64;
export const d128 = decimal_type("d128", D128_LIMITS) as D128;

import { Prettify } from "../lib/types";
import type {
  Chars,
  i128,
  i16,
  i32,
  i64,
  i8,
  isize,
  u128,
  u16,
  u32,
  u64,
  u8,
  usize,
} from "./numbers";
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
// Arithmetic is done with methods instead: a.add(b), a.mul(b), ... They never mutate:
// every one returns a new decimal, and the bigint math stays inside DecimalImpl.

export type DecimalKind = "d32" | "d64" | "d128";

export interface Decimal<K extends DecimalKind = DecimalKind, S extends number = number> {
  readonly kind: K;
  /** how many digits come after the point: "-1.50" has scale 2 */
  readonly scale: S;
  /** always keeps the scale, e.g. "1.50" */
  to_string(): string;
  /** a string, never a JSON number, so the exact value survives JSON.stringify */
  toJSON(): string;

  // The argument is a decimal of the same kind (mixing kinds is a type error, and throws)
  // or an integer. Floats are not accepted: a float already carries binary error (0.1 + 0.2
  // is 0.30000000000000004), and NaN and Infinity are not decimals. A result that does not
  // fit the kind's digit limit throws. The result types are written as d32<S>, d64<S> and
  // d128<S> (see DecimalOf) so hovers and errors show exactly which kind you are using.

  /** this + other. The scale is the larger of the two: 0.10000 + 0.3222 is 0.42220. */
  add<T extends number>(other: DecimalOf<K, T>): DecimalOf<K, MaxScale<S, T>>;
  /** this + an integer (scale 0). Floats are not accepted. */
  add<const N extends IntLike>(other: IntArg<N>): DecimalOf<K, S>;

  /** this - other. The scale is the larger of the two. */
  sub<T extends number>(other: DecimalOf<K, T>): DecimalOf<K, MaxScale<S, T>>;
  /** this - an integer (scale 0). Floats are not accepted. */
  sub<const N extends IntLike>(other: IntArg<N>): DecimalOf<K, S>;

  /**
   * this * other. The scale is the sum of the two, so 1.5 * 1.5 is 2.25. A sum over the
   * kind's scale limit is a compile error.
   */
  mul<T extends number>(other: MulArg<K, S, T>): DecimalOf<K, SumScale<S, T>>;
  /** this * an integer (scale 0). Floats are not accepted. */
  mul<const N extends IntLike>(other: IntArg<N>): DecimalOf<K, S>;

  /**
   * this / other, only when the answer is exact. It keeps the places the numbers have
   * (6.00 / 3 is 2.00) and adds more only if needed (1 / 4 is 0.25). 1 / 3 never ends, so it
   * throws, and so does a zero divisor. The scale is only known at runtime.
   */
  div<T extends number>(other: DecimalOf<K, T>): DecimalOf<K, number>;
  /** this / an integer, with the same rules. Floats are not accepted. */
  div<const N extends IntLike>(other: IntArg<N>): DecimalOf<K, number>;

  /** the remainder of this / other, with the sign of this (like Rust's %). A zero divisor throws. */
  rem<T extends number>(other: DecimalOf<K, T>): DecimalOf<K, MaxScale<S, T>>;
  /** the remainder of this / an integer. Floats are not accepted. */
  rem<const N extends IntLike>(other: IntArg<N>): DecimalOf<K, S>;

  /** -this, with the same scale */
  neg(): DecimalOf<K, S>;

  /** true if the values are equal. The scale is ignored: 1.0 equals 1.00. */
  eq<T extends number>(other: DecimalOf<K, T>): boolean;
  /** true if this equals an integer. Floats are not accepted. */
  eq<const N extends IntLike>(other: IntArg<N>): boolean;
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

// ----------------------------------------------------------------- methods
// The scales of the arguments are literal numbers, so the result scale is computed while
// compiling. A scale that is not a literal (plain `number`) gives `number`.

/** the named type of a kind (d32<S>, d64<S> or d128<S>), so hovers and errors show it */
type DecimalOf<K extends DecimalKind, S extends number> = K extends "d32"
  ? d32<S>
  : K extends "d64"
    ? d64<S>
    : d128<S>;

type LimitsOf<K extends DecimalKind> = K extends "d32"
  ? typeof D32_LIMITS
  : K extends "d64"
    ? typeof D64_LIMITS
    : typeof D128_LIMITS;

type IntLike = u8 | u16 | u32 | usize | u64 | u128 | i8 | i16 | i32 | isize | i64 | i128;

type FloatNotAllowed = "floats are not accepted: pass an integer or a decimal of the same kind";
type ResultTooManyPlaces = "the result would have too many decimal places for this decimal type";

/** N itself when it is an integer, otherwise an error message. Non-literals are checked at runtime. */
type IntArg<N extends IntLike> = N extends number
  ? number extends N
    ? N
    : `${N}` extends `${string}${"." | "e" | "E"}${string}`
      ? FloatNotAllowed
      : N
  : N;

type MaxScale<A extends number, B extends number> = number extends A
  ? number
  : number extends B
    ? number
    : Tup<A> extends [...Tup<B>, ...unknown[]]
      ? A
      : B;

type SumScale<A extends number, B extends number> = number extends A
  ? number
  : number extends B
    ? number
    : [...Tup<A>, ...Tup<B>] extends infer R extends unknown[]
      ? R["length"]
      : never;

// N is at most the scale limit
type ScaleFits<N extends number, L extends Limits> = number extends N
  ? true
  : Tup<L["scale"]> extends [...Tup<N>, ...unknown[]]
    ? true
    : false;

/** the decimal itself when the product's scale fits the kind, otherwise an error message */
type MulArg<K extends DecimalKind, S extends number, T extends number> =
  ScaleFits<SumScale<S, T>, LimitsOf<K>> extends true ? DecimalOf<K, T> : ResultTooManyPlaces;

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

const LIMITS: Record<DecimalKind, Limits> = {
  d32: D32_LIMITS,
  d64: D64_LIMITS,
  d128: D128_LIMITS,
};

const pow10 = (n: number): bigint => 10n ** BigInt(n);
const abs = (n: bigint): bigint => (n < 0n ? -n : n);

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** "-1.50" is mantissa -150n with scale 2 */
function format_decimal(mantissa: bigint, scale: number): string {
  const sign = mantissa < 0n ? "-" : "";
  const digits = abs(mantissa).toString();
  if (scale === 0) return sign + digits;
  const padded = digits.padStart(scale + 1, "0");
  const split = padded.length - scale;
  return `${sign}${padded.slice(0, split)}.${padded.slice(split)}`;
}

type Operand = { readonly mantissa: bigint; readonly scale: number };

// The method signatures are on the Decimal interface (they are too generic for the class
// to implement), so the class only promises the plain members. `make` does the cast.
class DecimalImpl<K extends DecimalKind, S extends number> implements Pick<
  Decimal<K, S>,
  "kind" | "scale" | "to_string" | "toJSON"
> {
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
    return format_decimal(this.#mantissa, this.scale);
  }

  toJSON(): string {
    return this.to_string();
  }

  /** other as a mantissa and a scale. Throws for another kind, a float, or anything else. */
  #operand(other: unknown): Operand {
    if (typeof other === "object" && other !== null && #mantissa in other) {
      if (other.kind !== this.kind)
        throw new TypeError(`cannot mix ${this.kind} with ${other.kind}`);
      return { mantissa: other.#mantissa, scale: other.scale };
    }
    if (typeof other === "bigint") return { mantissa: other, scale: 0 };
    if (typeof other === "number") {
      if (!Number.isInteger(other))
        throw new TypeError(
          `${this.kind} does not accept floats (${other}): pass an integer or another ${this.kind}`,
        );
      return { mantissa: BigInt(other), scale: 0 };
    }
    throw new TypeError(`expected a ${this.kind} or an integer, got ${typeof other}`);
  }

  /** both mantissas rescaled to the larger of the two scales */
  #align(other: Operand): { a: bigint; b: bigint; scale: number } {
    const scale = Math.max(this.scale, other.scale);
    return {
      a: this.#mantissa * pow10(scale - this.scale),
      b: other.mantissa * pow10(scale - other.scale),
      scale,
    };
  }

  /** the result, if it fits the limits of this kind. Otherwise throws. */
  #fit(mantissa: bigint, scale: number): Decimal<K> {
    const limits = LIMITS[this.kind];
    if (scale > limits.scale)
      throw new RangeError(
        `result out of range for ${this.kind}: ${format_decimal(mantissa, scale)} (at most ${limits.scale} decimal places)`,
      );
    if (abs(mantissa).toString().length > limits.digits)
      throw new RangeError(
        `result out of range for ${this.kind}: ${format_decimal(mantissa, scale)} (at most ${limits.digits} significant digits)`,
      );
    return make<K, number>(this.kind, mantissa, scale);
  }

  add(other: unknown): Decimal<K> {
    const { a, b, scale } = this.#align(this.#operand(other));
    return this.#fit(a + b, scale);
  }

  sub(other: unknown): Decimal<K> {
    const { a, b, scale } = this.#align(this.#operand(other));
    return this.#fit(a - b, scale);
  }

  mul(other: unknown): Decimal<K> {
    const b = this.#operand(other);
    return this.#fit(this.#mantissa * b.mantissa, this.scale + b.scale);
  }

  div(other: unknown): Decimal<K> {
    const divisor = this.#operand(other);
    // (a / 10^sa) / (b / 10^sb) is num / den, both whole numbers
    const num = this.#mantissa * pow10(divisor.scale);
    const den = divisor.mantissa * pow10(this.scale);
    if (den === 0n) throw new RangeError("attempt to divide by zero");
    // num / den ends only if, once reduced, the denominator is 2^x * 5^y. It then needs
    // max(x, y) decimal places.
    let rest = abs(den) / gcd(abs(num), abs(den));
    let twos = 0;
    let fives = 0;
    while (rest % 2n === 0n) {
      rest /= 2n;
      twos++;
    }
    while (rest % 5n === 0n) {
      rest /= 5n;
      fives++;
    }
    if (rest !== 1n)
      throw new RangeError(
        `${this.kind} cannot divide ${this.to_string()} by ${format_decimal(divisor.mantissa, divisor.scale)} exactly: the result never ends`,
      );
    // keep the places the numbers already have: 6.00 / 3 is 2.00
    const scale = Math.max(twos, fives, this.scale - divisor.scale);
    return this.#fit((num * pow10(scale)) / den, scale);
  }

  // the sign follows this, like Rust's %
  rem(other: unknown): Decimal<K> {
    const { a, b, scale } = this.#align(this.#operand(other));
    if (b === 0n) throw new RangeError("attempt to calculate the remainder with a divisor of zero");
    return this.#fit(a % b, scale);
  }

  neg(): Decimal<K> {
    return make<K, number>(this.kind, -this.#mantissa, this.scale);
  }

  eq(other: unknown): boolean {
    const { a, b } = this.#align(this.#operand(other));
    return a === b;
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

function make<K extends DecimalKind, S extends number>(
  kind: K,
  mantissa: bigint,
  scale: S,
): Decimal<K, S> {
  return new DecimalImpl(kind, mantissa, scale) as unknown as Decimal<K, S>;
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
    make(kind, sign === "-" ? -magnitude : magnitude, frac.length),
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

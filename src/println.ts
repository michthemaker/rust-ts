import { FMT } from "./fmt";
import { inspect } from "./inspect";

// ---------------- argument classification ----------------

/** Debug (`{:?}`): primitives, or anything implementing the [FMT] protocol. */
type HasDebug<T> = T extends string | number | boolean | bigint
  ? true
  : T extends { [FMT](...args: any[]): string }
    ? true
    : false;

/**
 * Display (`{}`): primitives, or an object with to_string()/toJSON()/toString().
 *
 * CAVEAT: every JS object structurally has toString(): string, inherited from
 * Object.prototype, so the toString branch is true for almost any object type —
 * including ones with no real Display, like Vec. This gate will not actually
 * reject those. If you want {} to mean "has a real Display", drop the toString
 * branch and require to_string() or toJSON() only.
 */
type HasDisplay<T> = T extends string | number | boolean | bigint
  ? true
  : T extends { to_string(): string }
    ? true
    : T extends { toJSON(): string }
      ? true
      : T extends { toString(): string }
        ? true
        : false;

// ---------------- positional format-string parser ----------------

type ValidateFormat<
  Str extends string,
  Args extends any[],
  Index extends any[] = [],
> = Str extends `${string}{:?}${infer Tail}`
  ? Index["length"] extends Args["length"]
    ? `Error: missing argument for '{:?}' placeholder (expected argument ${Index["length"]})`
    : HasDebug<Args[Index["length"]]> extends true
      ? ValidateFormat<Tail, Args, [...Index, any]>
      : `Error: argument ${Index["length"]} has no Debug ([FMT]) form for '{:?}'`
  : Str extends `${string}{}${infer Tail}`
    ? Index["length"] extends Args["length"]
      ? `Error: missing argument for '{}' placeholder (expected argument ${Index["length"]})`
      : HasDisplay<Args[Index["length"]]> extends true
        ? ValidateFormat<Tail, Args, [...Index, any]>
        : `Error: argument ${Index["length"]} has no Display (to_string/toJSON) form; use '{:?}'`
    : Index["length"] extends Args["length"]
      ? Str
      : `Error: too many arguments provided (expected ${Index["length"]}, got ${Args["length"]})`;

// ---------------- println ----------------

export function println(): void;
export function println<Str extends string, Args extends any[]>(
  format: ValidateFormat<Str, Args>,
  ...args: Args
): void;
export function println(format?: string, ...args: unknown[]): void {
  if (format === undefined) return console.log();

  let next = 0;
  const text = format.replace(/\{:\?\}|\{\}/g, (token) => {
    if (next >= args.length) throw new Error(`println: no argument for placeholder ${next + 1}`);
    const arg = args[next++];
    return token === "{:?}" ? debug_str(arg) : display_str(arg);
  });

  if (next !== args.length)
    throw new Error(`println: ${args.length} arguments but only ${next} placeholders`);
  console.log(text);
}

const display_str = (arg: unknown): string => (typeof arg === "string" ? arg : String(arg));

const debug_str = (arg: unknown): string =>
  typeof arg === "bigint" ? arg.toString() : inspect(arg);

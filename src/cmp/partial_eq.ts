import { impls, trait } from "../trait";

export const PartialEq = <T>() =>
  trait((b) => {
    abstract class PartialEq extends b {
      abstract eq(other: T): boolean;
      abstract ne(other: T): boolean;
    }
    return PartialEq;
  });

/**
 * Deep equality on any two values.
 *
 * @remarks `eq` is called on a value whose class implements `PartialEq` trait
 * @remarks Errors are equal when their class, name, message and cause match. The stack is ignored.
 * @remarks Everything else is compared structurally: primitives, dates, regexps, arrays, sets, maps and plain objects.
 */
export function is_eq(a: any, b: any): boolean {
  // 1. Primitive Identity & Matching Reference Identity
  if (a === b) return true;

  // 2. Handle NaN
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }

  // 3. Early Exit if Types diverge or are nullish
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }

  // 4. Custom equality (PartialEq): the type decides. Only reached for two values of the same class.
  if (impls(a, PartialEq)) return a.eq(b);

  // 5. Structural Verification based on Prototypes
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  // 6. Native Date Objects
  if (a instanceof Date) return a.getTime() === b.getTime();

  // 7. Native RegExp Rules
  if (a instanceof RegExp) return a.toString() === b.toString();

  // 8. Errors: class (checked above), name, message and cause. The stack differs per creation site, so it is ignored.
  if (a instanceof Error) {
    return (
      a.name === b.name &&
      a.message === b.message &&
      is_eq(a.cause, b.cause) &&
      (typeof AggregateError === "undefined" ||
        !(a instanceof AggregateError) ||
        is_eq(a.errors, b.errors)) &&
      own_fields_equal(a, b) // custom fields such as `code`
    );
  }

  // 9. Arrays Deep Structural Verification
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!is_eq(a[i], b[i])) return false;
    }
    return true;
  }

  // 10. Native JavaScript Set Deep Check
  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    // For every entry in Set A, check if a deep-match exists anywhere in Set B
    for (const itemA of a) {
      let found = false;
      for (const itemB of b) {
        if (is_eq(itemA, itemB)) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  // 11. Native JavaScript Map Deep Check
  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [keyA, valA] of a.entries()) {
      let foundKeyB = false;
      // Maps check structural keys as well as structural values
      for (const [keyB, valB] of b.entries()) {
        if (is_eq(keyA, keyB) && is_eq(valA, valB)) {
          foundKeyB = true;
          break;
        }
      }
      if (!foundKeyB) return false;
    }
    return true;
  }

  // 12. Plain Objects / Custom Class Instantiations (Struct Parity)
  return own_fields_equal(a, b);
}

/**
 * Deep not equality on any two values.
 */
export function is_ne(a: any, b: any): boolean {
  return !is_eq(a, b);
}

/** the own enumerable fields of both objects are the same keys with deeply equal values */
function own_fields_equal(a: any, b: any): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !is_eq(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

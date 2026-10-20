export interface PartialEq<T> {
  eq(other: T): boolean;
  ne(other: T): boolean;
}

/**
 * Deep equality on any two values.
 *
 * @remarks A value whose class defines `eq` (the PartialEq contract) decides for itself, so private state counts too.
 * @remarks Errors are equal when their class, name, message and cause match. The stack is ignored.
 * @remarks Everything else is compared structurally: primitives, dates, regexps, arrays, sets, maps and plain objects.
 */
export function is_equal(a: any, b: any): boolean {
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
  if (typeof a.eq === "function") return a.eq(b);

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
      is_equal(a.cause, b.cause) &&
      (typeof AggregateError === "undefined" ||
        !(a instanceof AggregateError) ||
        is_equal(a.errors, b.errors)) &&
      own_fields_equal(a, b) // custom fields such as `code`
    );
  }

  // 9. Arrays Deep Structural Verification
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!is_equal(a[i], b[i])) return false;
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
        if (is_equal(itemA, itemB)) {
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
        if (is_equal(keyA, keyB) && is_equal(valA, valB)) {
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

/** the own enumerable fields of both objects are the same keys with deeply equal values */
function own_fields_equal(a: any, b: any): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !is_equal(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

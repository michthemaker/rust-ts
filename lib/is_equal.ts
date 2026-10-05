/**
 * @deep equal on any type
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

  // 4. Structural Verification based on Prototypes
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  // 5. Native Date Objects
  if (a instanceof Date) return a.getTime() === b.getTime();

  // 6. Native RegExp Rules
  if (a instanceof RegExp) return a.toString() === b.toString();

  // 7. Arrays Deep Structural Verification
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!is_equal(a[i], b[i])) return false;
    }
    return true;
  }

  // 8. Native JavaScript Set Deep Check
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

  // 9. Native JavaScript Map Deep Check
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

  // 10. Plain Objects / Custom Class Instantiations (Struct Parity)
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

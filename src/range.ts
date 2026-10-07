/**
 * Generates an efficient, lazy sequence of numbers from start to end.
 * @param start - The starting number of the range (inclusive).
 * @param end - The ending number of the range (exclusive).
 * @param step - The step increment (defaults to 1 or -1 based on boundaries).
 */
function* range(start: number, end: number, step?: number): Generator<number, void, unknown> {
  // If step isn't provided, deduce it based on direction
  const resolvedStep = step ?? (start <= end ? 1 : -1);

  // Guard against infinite loops with zero step
  if (resolvedStep === 0) {
    throw new RangeError("range() step argument must not be zero");
  }

  // Handle ascending sequence
  if (resolvedStep > 0) {
    for (let i = start; i < end; i += resolvedStep) {
      yield i;
    }
  }
  // Handle descending sequence
  else {
    for (let i = start; i > end; i += resolvedStep) {
      yield i;
    }
  }
}

export { range };

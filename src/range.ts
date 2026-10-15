export interface Range extends Generator<number, void, unknown> {
  readonly start: number;
  readonly end: number;
  readonly step: number;
  readonly inclusive?: boolean;
}

function* gen(start: number, end: number, step: number): Generator<number, void, unknown> {
  if (step > 0) for (let i = start; i < end; i += step) yield i;
  else for (let i = start; i > end; i += step) yield i;
}

export function range(start: number, end: number, step?: number): Range {
  const resolved = step ?? (start <= end ? 1 : -1);
  if (resolved === 0) throw new RangeError("range() step argument must not be zero");
  return Object.assign(gen(start, end, resolved), { start, end, step: resolved }) as Range;
}

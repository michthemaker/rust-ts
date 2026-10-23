import { is_eq, PartialEq } from "./cmp";
import { Option } from "./option";
import { Result } from "./result";
import type { Vec } from "./vec_impl";
import { Range } from "./range";
import { impl } from "./trait";
import { Debug, FMT } from "./fmt";
import { Clone, clone_of } from "./clone";
import { Default } from "./default";

const DEBUG = Symbol.for("nodejs.util.inspect.custom");
const INDEX = /^(0|[1-9]\d*)$/;

function panic(msg: string): never {
  throw new Error(msg);
}

const cmp_default = (a: any, b: any): number => (a < b ? -1 : a > b ? 1 : 0);

type Source<T> = Slice<T> | readonly T[];

/** Turns a range into a checked [start, end) pair, panicking like Rust's slice indexing. */
export function resolve_range(r: Range, len: number): [number, number] {
  const start = r.start;
  const end = r.inclusive ? r.end + 1 : r.end;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0)
    panic(`range ${start}..${end} must use non-negative integers`);
  if (start > end) panic(`slice index starts at ${start} but ends at ${end}`);
  if (r.step !== 1) panic("slicing ranges cannot have a step");
  if (end > len) panic(`range end index ${end} out of range for slice of length ${len}`);
  return [start, end];
}

function try_resolve_range(r: Range, len: number): [number, number] | undefined {
  try {
    return resolve_range(r, len);
  } catch {
    return undefined;
  }
}

// Slice cannot import Vec at runtime (Vec extends Slice), so Vec registers a factory
// when it loads. Methods that return a Vec (to_vec, concat, join, repeat) use it.
let make_vec: ((items: any[]) => any) | undefined;
export function register_vec_factory(factory: (items: any[]) => any): void {
  make_vec = factory;
}
function new_vec<U>(items: U[]): Vec<U> {
  if (!make_vec)
    throw new Error("Vec is not loaded: import it before calling to_vec/concat/join/repeat");
  return make_vec(items);
}

function as_array<T>(src: Source<T>): readonly T[] {
  return Array.isArray(src) ? src : (src as Slice<T>).to_array();
}

/**
 * A view over someone else's array: (buf, start, len).
 * Never copies on construction. Sub-slices share `buf`, so mutation through
 * one view is visible in the owner (and in every overlapping view).
 */
export abstract class Slice<T> extends impl(
  Clone,
  Default,
  PartialEq<Source<any>>,
  Debug,
  class Abc {},
) {
  protected buf: T[];
  protected start: number;
  protected _len: number;
  /** throws if this view is no longer valid (set by owners that can restructure, like Vec) */
  protected guard?: () => void;

  [FMT](_depth: number, options: any, inspect: Function) {
    try {
      this.guard?.();
    } catch {
      return "&[<invalidated>]";
    }
    const items = this.to_array().map((item) => inspect(item, options));
    return `&[${items.join(", ")}]`;
  }

  constructor(buf: T[], start: number, len: number, guard?: () => void) {
    super();
    this.buf = buf;
    this.start = start;
    this._len = len;
    this.guard = guard;

    return new Proxy(this, {
      get(target, prop) {
        if (prop !== DEBUG) target.guard?.();
        if (typeof prop === "string" && INDEX.test(prop)) {
          const index = Number(prop);
          if (index >= target._len)
            panic(`index out of bounds: the len is ${target._len} but the index is ${index}`);
          return target.buf[target.start + index];
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? (value as any).bind(target) : value;
      },
      set(target, prop, value) {
        target.guard?.();
        if (typeof prop === "string" && INDEX.test(prop)) {
          const index = Number(prop);
          if (index >= target._len)
            panic(`index out of bounds: the len is ${target._len} but the index is ${index}`);
          target.buf[target.start + index] = value;
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    });
  }

  // ---------------------------------------------------------------- views

  /** a new view over the same buffer: [from, to) relative to this slice */
  protected sub(from: number, to: number): Slice<T> {
    // @ts-ignore
    return new Slice(this.buf, this.start + from, to - from, this.guard);
  }

  // ------------------------------------------------------------- basic info

  public len(): number {
    return this._len;
  }

  public is_empty(): boolean {
    return this._len === 0;
  }

  public to_array(): T[] {
    return this.buf.slice(this.start, this.start + this._len);
  }

  // ---------------------------------------------------------------- access

  public get(index: number): Option<T>;
  public get(range: Range): Option<Slice<T>>;
  public get(arg: number | Range): Option<T> | Option<Slice<T>> {
    if (typeof arg === "number") {
      if (!Number.isInteger(arg) || arg < 0 || arg >= this._len) return Option.None();
      return Option.Some(this.buf[this.start + arg]);
    }
    const bounds = try_resolve_range(arg, this._len);
    if (!bounds) return Option.None();
    return Option.Some(this.sub(bounds[0], bounds[1]));
  }

  /** `&v[a..b]`: a view of the range. Panics if the range is out of bounds; see `get(range)` for the checked form. */
  public slice(range: Range): Slice<T> {
    const [from, to] = resolve_range(range, this._len);
    return this.sub(from, to);
  }

  public first(): Option<T> {
    return this.get(0);
  }

  public last(): Option<T> {
    return this.get(this._len - 1);
  }

  public split_first(): Option<[T, Slice<T>]> {
    if (this._len === 0) return Option.None();
    return Option.Some<[T, Slice<T>]>([this.buf[this.start], this.sub(1, this._len)]);
  }

  public split_last(): Option<[T, Slice<T>]> {
    if (this._len === 0) return Option.None();
    return Option.Some<[T, Slice<T>]>([
      this.buf[this.start + this._len - 1],
      this.sub(0, this._len - 1),
    ]);
  }

  public split_at(mid: number): [Slice<T>, Slice<T>] {
    if (mid < 0 || mid > this._len) panic("mid > len");
    return [this.sub(0, mid), this.sub(mid, this._len)];
  }

  public split_at_checked(mid: number): Option<[Slice<T>, Slice<T>]> {
    if (mid < 0 || mid > this._len) return Option.None();
    return Option.Some<[Slice<T>, Slice<T>]>([this.sub(0, mid), this.sub(mid, this._len)]);
  }

  // ------------------------------------------------------------- iteration

  public *iter(): IterableIterator<T> {
    for (let i = 0; i < this._len; i++) {
      this.guard?.();
      yield this.buf[this.start + i];
    }
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this.iter();
  }

  public windows(size: number): IterableIterator<Slice<T>> {
    if (size <= 0) panic("window size must be non-zero");
    const self = this;
    return (function* () {
      for (let i = 0; i + size <= self._len; i++) {
        self.guard?.();
        yield self.sub(i, i + size);
      }
    })();
  }

  public chunks(size: number): IterableIterator<Slice<T>> {
    if (size <= 0) panic("chunk size must be non-zero");
    const self = this;
    return (function* () {
      for (let i = 0; i < self._len; i += size) {
        self.guard?.();
        yield self.sub(i, Math.min(i + size, self._len));
      }
    })();
  }

  public chunks_exact(size: number): IterableIterator<Slice<T>> {
    if (size <= 0) panic("chunk size must be non-zero");
    const self = this;
    return (function* () {
      for (let i = 0; i + size <= self._len; i += size) {
        self.guard?.();
        yield self.sub(i, i + size);
      }
    })();
  }

  // ------------------------------------------------------------- searching

  public contains(value: T): boolean {
    for (let i = 0; i < this._len; i++) {
      if (is_eq(this.buf[this.start + i], value)) return true;
    }
    return false;
  }

  public starts_with(needle: Source<T>): boolean {
    const n = as_array(needle);
    if (n.length > this._len) return false;
    for (let i = 0; i < n.length; i++) {
      if (!is_eq(this.buf[this.start + i], n[i])) return false;
    }
    return true;
  }

  public ends_with(needle: Source<T>): boolean {
    const n = as_array(needle);
    if (n.length > this._len) return false;
    const offset = this._len - n.length;
    for (let i = 0; i < n.length; i++) {
      if (!is_eq(this.buf[this.start + offset + i], n[i])) return false;
    }
    return true;
  }

  /** Ok(index) if found, Err(insertion_point) otherwise. Assumes the slice is sorted. */
  public binary_search(
    target: T,
    compare: (a: T, b: T) => number = cmp_default,
  ): Result<number, number> {
    let low = 0;
    let high = this._len;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const ord = compare(this.buf[this.start + mid], target);
      if (ord === 0) return Result.Ok<number, number>(mid);
      if (ord < 0) low = mid + 1;
      else high = mid;
    }
    return Result.Err<number, number>(low);
  }

  /** Subslices separated by elements matching `pred` (the matching elements are not included). */
  public split(pred: (item: T) => boolean): IterableIterator<Slice<T>> {
    const self = this;
    return (function* () {
      let from = 0;
      for (let i = 0; i < self._len; i++) {
        self.guard?.();
        if (pred(self.buf[self.start + i])) {
          yield self.sub(from, i);
          from = i + 1;
        }
      }
      yield self.sub(from, self._len);
    })();
  }

  /** Clones every element into a new Vec. */
  public to_vec(): Vec<T> {
    return new_vec(this.to_array().map((item) => clone_of(item)));
  }

  /** Flattens a slice of slices/arrays into one Vec. (For strings use `join("")`.) */
  public concat<U>(this: Slice<Source<U>>): Vec<U> {
    const out: U[] = [];
    for (let i = 0; i < this._len; i++)
      for (const x of as_array(this.buf[this.start + i])) out.push(x);
    return new_vec(out);
  }

  /** Strings: joins with `sep`. Slices/arrays: flattens with the slice `sep` between them. */
  public join(this: Slice<string>, sep: string): string;
  public join<U>(this: Slice<Source<U>>, sep: Source<U>): Vec<U>;
  public join(this: Slice<any>, sep: any): any {
    if (typeof sep === "string") return this.to_array().join(sep);
    const separator = as_array<any>(sep);
    const out: any[] = [];
    for (let i = 0; i < this._len; i++) {
      if (i > 0) for (const s of separator) out.push(s);
      for (const x of as_array<any>(this.buf[this.start + i])) out.push(x);
    }
    return new_vec(out);
  }

  /** A new Vec holding this slice's elements `n` times in a row (each repetition is a clone). */
  public repeat(n: number): Vec<T> {
    if (!Number.isInteger(n) || n < 0) panic("repeat count must be a non-negative integer");
    const out: T[] = [];
    for (let k = 0; k < n; k++)
      for (let i = 0; i < this._len; i++) out.push(clone_of(this.buf[this.start + i]));
    return new_vec(out);
  }

  /** Copies the elements in `range` to `dest`, overlap-safe (like memmove). Panics if either end is out of bounds. */
  public copy_within(range: Range, dest: number): void {
    const [from, to] = resolve_range(range, this._len);
    const count = to - from;
    if (!Number.isInteger(dest) || dest < 0 || dest > this._len - count)
      panic("dest is out of bounds");
    const moved = this.buf.slice(this.start + from, this.start + to);
    for (let i = 0; i < count; i++) this.buf[this.start + dest + i] = moved[i];
  }

  /** Like copy_from_slice, but clones each element. Panics if the lengths differ. */
  public clone_from_slice(src: Source<T>): void {
    const s = as_array(src);
    if (s.length !== this._len) panic("destination and source slices have different lengths");
    for (let i = 0; i < this._len; i++) this.buf[this.start + i] = clone_of(s[i]);
  }

  // ------------------------------------------------------------ in-place ops

  public swap(a: number, b: number): void {
    if (a < 0 || a >= this._len)
      panic(`index out of bounds: the len is ${this._len} but the index is ${a}`);
    if (b < 0 || b >= this._len)
      panic(`index out of bounds: the len is ${this._len} but the index is ${b}`);
    const tmp = this.buf[this.start + a];
    this.buf[this.start + a] = this.buf[this.start + b];
    this.buf[this.start + b] = tmp;
  }

  public reverse(): void {
    for (let i = 0, j = this._len - 1; i < j; i++, j--) this.swap(i, j);
  }

  public fill(value: T): void {
    for (let i = 0; i < this._len; i++) this.buf[this.start + i] = value;
  }

  public fill_with(make: () => T): void {
    for (let i = 0; i < this._len; i++) this.buf[this.start + i] = make();
  }

  public rotate_left(k: number): void {
    if (k < 0 || k > this._len) panic("assertion failed: mid <= self.len()");
    const part = this.to_array();
    this.write_back(part.slice(k).concat(part.slice(0, k)));
  }

  public rotate_right(k: number): void {
    if (k < 0 || k > this._len) panic("assertion failed: k <= self.len()");
    this.rotate_left(this._len - k);
  }

  public copy_from_slice(src: Source<T>): void {
    const s = as_array(src);
    if (s.length !== this._len)
      panic(
        `source slice length (${s.length}) does not match destination slice length (${this._len})`,
      );
    for (let i = 0; i < this._len; i++) this.buf[this.start + i] = s[i];
  }

  public sort(): void {
    this.sort_by(cmp_default);
  }

  public sort_by(compare: (a: T, b: T) => number): void {
    this.write_back(this.to_array().sort(compare));
  }

  public sort_by_key<K>(key: (item: T) => K): void {
    this.sort_by((a, b) => cmp_default(key(a), key(b)));
  }

  /** writes `values` over [start, start + len) of the shared buffer */
  protected write_back(values: T[]): void {
    for (let i = 0; i < this._len; i++) this.buf[this.start + i] = values[i];
  }

  /**
   * True when `other` is a slice or an array with the same length and equal elements (compared with `is_equal`).
   *
   * @remarks Capacity and the kind of container (Vec, FixedArray, view, plain array) do not matter.
   * @remarks Anything else is simply not equal: this never throws for the wrong kind of value.
   */
  public eq(other: Source<T>): boolean {
    if (other instanceof Slice) {
      if (other._len !== this._len) return false;
      for (let i = 0; i < this._len; i++) {
        if (!is_eq(this.buf[this.start + i], other.buf[other.start + i])) return false;
      }
      return true;
    }
    if (Array.isArray(other)) {
      if (other.length !== this._len) return false;
      for (let i = 0; i < this._len; i++) {
        if (!is_eq(this.buf[this.start + i], other[i])) return false;
      }
      return true;
    }
    return false;
  }

  public ne(other: Source<T>): boolean {
    return !this.eq(other);
  }

  public clone(): Slice<T> {
    return this.sub(0, this._len);
  }
}

export interface Slice<T> {
  [index: number]: T;
}

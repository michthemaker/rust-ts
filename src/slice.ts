import { is_equal } from "../lib/is_equal";
import { Option } from "./option";
import { Result } from "./result";

const DEBUG = Symbol.for("nodejs.util.inspect.custom");
const INDEX = /^(0|[1-9]\d*)$/;

function panic(msg: string): never {
  throw new Error(msg);
}

const cmp_default = (a: any, b: any): number => (a < b ? -1 : a > b ? 1 : 0);

type Source<T> = Slice<T> | readonly T[];

function as_array<T>(src: Source<T>): readonly T[] {
  return Array.isArray(src) ? src : (src as Slice<T>).to_array();
}

/**
 * A view over someone else's array: (buf, start, len).
 * Never copies on construction. Sub-slices share `buf`, so mutation through
 * one view is visible in the owner (and in every overlapping view).
 */
export class Slice<T> {
  protected buf: T[];
  protected start: number;
  protected _len: number;

  [DEBUG](_depth: number, options: any, inspect: Function) {
    const items = this.to_array().map((item) => inspect(item, options));
    return `Slice[${items.join(", ")}]`;
  }

  constructor(buf: T[], start: number, len: number) {
    this.buf = buf;
    this.start = start;
    this._len = len;

    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === "string" && INDEX.test(prop)) {
          const index = Number(prop);
          if (index >= target._len)
            panic(`index out of bounds: the len is ${target._len} but the index is ${index}`);
          return target.buf[target.start + index];
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
      set(target, prop, value) {
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
    return new Slice(this.buf, this.start + from, to - from);
  }

  public as_slice() {
    return new Slice(this.buf, 0, this._len);
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

  public get(index: number): Option<T> {
    if (!Number.isInteger(index) || index < 0 || index >= this._len) return Option.None();
    return Option.Some(this.buf[this.start + index]);
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
    for (let i = 0; i < this._len; i++) yield this.buf[this.start + i];
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this.iter();
  }

  public windows(size: number): IterableIterator<Slice<T>> {
    if (size <= 0) panic("window size must be non-zero");
    const self = this;
    return (function* () {
      for (let i = 0; i + size <= self._len; i++) yield self.sub(i, i + size);
    })();
  }

  public chunks(size: number): IterableIterator<Slice<T>> {
    if (size <= 0) panic("chunk size must be non-zero");
    const self = this;
    return (function* () {
      for (let i = 0; i < self._len; i += size) yield self.sub(i, Math.min(i + size, self._len));
    })();
  }

  public chunks_exact(size: number): IterableIterator<Slice<T>> {
    if (size <= 0) panic("chunk size must be non-zero");
    const self = this;
    return (function* () {
      for (let i = 0; i + size <= self._len; i += size) yield self.sub(i, i + size);
    })();
  }

  // ------------------------------------------------------------- searching

  public contains(value: T): boolean {
    for (let i = 0; i < this._len; i++) {
      if (is_equal(this.buf[this.start + i], value)) return true;
    }
    return false;
  }

  public starts_with(needle: Source<T>): boolean {
    const n = as_array(needle);
    if (n.length > this._len) return false;
    for (let i = 0; i < n.length; i++) {
      if (!is_equal(this.buf[this.start + i], n[i])) return false;
    }
    return true;
  }

  public ends_with(needle: Source<T>): boolean {
    const n = as_array(needle);
    if (n.length > this._len) return false;
    const offset = this._len - n.length;
    for (let i = 0; i < n.length; i++) {
      if (!is_equal(this.buf[this.start + offset + i], n[i])) return false;
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

  public eq(other: Source<T>): boolean {
    return is_equal(this.to_array(), as_array(other));
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
}

export interface Slice<T> {
  [index: number]: T;
}

import { is_eq } from "./cmp/partial_eq";
import { clone_of } from "../lib/clone";
import { Option } from "./option";
import { range } from "./range";
import { FixedArray } from "./fixed_array";
import { Result } from "./result";
import { register_vec_factory, resolve_range, Slice } from "./slice";
import { type Range } from "./range";
import { FMT } from "./fmt";

const MAX_ARRAY_LENGTH = 4_294_967_295; // 2^32 - 1

const INDEX = /^(0|[1-9]\d*)$/;

export class Vec<T> extends Slice<T> {
  private _capacity: number;
  /** bumped by every structural change; views created from this Vec check it */
  private _version = 0;
  /** the Vec as the caller sees it (the index proxy), for methods that hand `self` back */
  private outer!: Vec<T>;

  [FMT](_depth: number, options: any, inspect: Function) {
    const first_half = this.buf.slice(0, this._len);
    const uninits = this._capacity - this._len;

    const formatted_elements = first_half.map((item) => inspect(item, options));

    if (uninits >= 2) {
      formatted_elements.push(`${uninits}x Uninit`);
    } else if (uninits === 1) {
      formatted_elements.push("Uninit");
    }

    return `Vec[${formatted_elements.join(", ")}]`;
  }

  private constructor(capacity: number, array?: Array<T>) {
    if (capacity > MAX_ARRAY_LENGTH || capacity < 0)
      throw new Error(
        `Requested allocation on Vec<T> exceeds engine memory limits.\nMaximum Vec<T> capacity is ${MAX_ARRAY_LENGTH}`,
      );
    const buf = array ? array.slice() : new Array<T>(capacity);
    super(buf, 0, array ? array.length : 0);
    this._capacity = capacity;
    const this_value = this;

    const proxy = new Proxy(this_value, {
      get(target, prop) {
        if (typeof prop === "string" && INDEX.test(prop)) {
          const index = Number(prop);
          if (!Number.isNaN(index) && Number.isInteger(index)) {
            return target
              .get(index)
              .expect(
                `index out of bounds: length is ${this_value._len} but the index is ${index}`,
              );
          }
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? (value as Function).bind(target) : value;
      },
      set(target, prop, value): boolean {
        if (typeof prop === "string" && INDEX.test(prop)) {
          // performs an update or insert
          const index = Number(prop);
          if (index in target.buf) target.buf[target.start + index] = value;
          else target.insert(index, value);
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    }) as any; // Cast to pretend it is a raw tuple alongside our class helper
    this_value.outer = proxy;
    return proxy;
  }

  public static from<T>(array: Array<T>) {
    return new this<T>(array.length, array);
  }

  public static with_capacity<T>(capacity: number) {
    return new this<T>(capacity);
  }

  public static new<T>() {
    return new this<T>(0);
  }

  /** `vec![value; n]`: n elements, each a clone of `value` (the last one is `value` itself). */
  public static from_elem<T>(value: T, n: number): Vec<T> {
    const v = new this<T>(n);
    if (n > 0) {
      for (let i = 0; i < n - 1; i++) v.buf[i] = clone_of(value);
      v.buf[n - 1] = value;
      v._len = n;
    }
    return v;
  }

  public to_array() {
    return this.buf.slice(0, this._len) as T[];
  }

  public clone() {
    const copy = Vec.with_capacity<T>(this._capacity);
    for (let i of range(0, this._len)) {
      const item = this.buf[i];
      copy[i] = clone_of(item);
    }
    return copy;
  }

  /**
   * @dev appends a value to the end of vector
   * if the capacity is equal to the length, doubles the capacity
   */
  public push(value: T): void {
    if (this._len === this._capacity)
      if (this._len === 0) this._capacity = 1;
      else this._capacity = this._capacity * 2;
    this.buf[this._len] = value;
    this._len++;
    this._version++;
  }

  /**
   * Inserts an element at a given position, shifting trailing elements right.
   * Panics with a runtime crash if index is out of active bounds.
   */
  public insert(index: number, value: T): void {
    if (index < 0 || index > this._len) {
      throw new Error(`index out of bounds: length is ${this._len} but index is ${index}`);
    }

    // Ensure space exists before inserting. reserve() handles growth rules.
    if (this._len >= this._capacity) {
      this.reserve(1);
    }
    this.buf.splice(index, 0, value);
    this._len++;
    this._version++;
  }

  /**
   * Removes an element at a given position, shifting trailing elements left and returning it.
   * Panics with a runtime crash if index is out of active bounds.
   */
  public remove(index: number): T {
    if (index < 0 || index >= this._len) {
      throw new Error(`index out of bounds: length is ${this._len} but index is ${index}`);
    }

    // 🚀 NO LOOPS: Extracts the element and shifts trailing elements left instantly.
    const [removedValue] = this.buf.splice(index, 1);
    this._len--;
    this._version++;

    // Splice shrinks array length by 1. Reset the underlying buffer length
    // back to its true capacity so we don't lose our pre-allocated slots.
    this.buf.length = this._capacity;

    return removedValue as T;
  }

  /** drops everything past `len` (so the GC can reclaim it) and restores the pre-allocated holes */
  private drop_tail(): void {
    this.buf.length = this._len;
    this.buf.length = this._capacity;
  }

  private check_len(n: number, what: string): void {
    if (!Number.isInteger(n) || n < 0) throw new Error(`${what} must be a non-negative integer`);
  }

  /** Removes the last element and returns it, or None if the vector is empty. */
  public pop(): Option<T> {
    if (this._len === 0) return Option.None();
    const value = this.buf[this._len - 1];
    this._len--;
    this._version++;
    delete this.buf[this._len];
    return Option.Some(value);
  }

  /** Removes every element. Capacity is unchanged. */
  public clear(): void {
    if (this._len > 0) this._version++;
    this._len = 0;
    this.drop_tail();
  }

  /** Keeps the first `len` elements and drops the rest. Does nothing if `len >= self.len()`. */
  public truncate(len: number): void {
    this.check_len(len, "truncate length");
    if (len >= this._len) return;
    this._version++;
    this._len = len;
    this.drop_tail();
  }

  /**
   * Resizes in place to `new_len`. Growing fills with clones of `value`
   * (the last slot takes `value` itself); shrinking truncates.
   */
  public resize(new_len: number, value: T): void {
    this.check_len(new_len, "resize length");
    if (new_len <= this._len) return this.truncate(new_len);
    this.reserve(new_len - this._len);
    const last = new_len - 1;
    for (let i = this._len; i < last; i++) this.buf[i] = clone_of(value);
    this.buf[last] = value;
    this._len = new_len;
    this._version++;
  }

  /**
   * Removes the element at `index` and returns it, filling the gap with the last element.
   * O(1), but does not keep the order. Panics if `index` is out of bounds.
   */
  public swap_remove(index: number): T {
    if (!Number.isInteger(index) || index < 0 || index >= this._len)
      throw new Error(`swap_remove index (is ${index}) should be < len (is ${this._len})`);
    const removed = this.buf[index];
    this.buf[index] = this.buf[this._len - 1];
    this._len--;
    this._version++;
    delete this.buf[this._len];
    return removed;
  }

  /** Moves every element of `other` onto the end of this vector, leaving `other` empty. */
  public append(other: Vec<T>): void {
    if (other.buf === this.buf) throw new Error("cannot append a Vec to itself");
    const count = other._len;
    if (count === 0) return;
    this.reserve(count);
    for (let i = 0; i < count; i++) this.buf[this._len + i] = other.buf[i];
    this._len += count;
    this._version++;
    other.clear();
  }

  /** Pushes every item of `items` (an array, a Slice, a Vec, a generator...). `items` is left alone. */
  public extend(items: Iterable<T>): void {
    const source = items instanceof Slice ? items.to_array() : items;
    for (const item of source) this.push(item);
  }

  /**
   * Splits at `at`: this vector keeps [0, at) and the returned one gets [at, len).
   * Panics if `at > len`.
   */
  public split_off(at: number): Vec<T> {
    if (!Number.isInteger(at) || at < 0 || at > this._len)
      throw new Error(`\`at\` split index (is ${at}) should be <= len (is ${this._len})`);
    const tail = Vec.from(this.buf.slice(at, this._len));
    if (at < this._len) this._version++;
    this._len = at;
    this.drop_tail();
    return tail;
  }

  /** Every view made from this Vec stops working after a structural change to it. */
  protected override sub(from: number, to: number): Slice<T> {
    const seen = this._version;
    return new Slice(this.buf, this.start + from, to - from, () => {
      if (this._version !== seen)
        throw new Error("slice invalidated: the Vec was modified after this view was created");
    });
  }

  /** A view of the whole Vec. Live while the Vec is unchanged; throws once the Vec is restructured. */
  public as_slice(): Slice<T> {
    return this.sub(0, this._len);
  }

  /** Removes and returns the last element if `pred` returns true for it, otherwise returns None. */
  public pop_if(pred: (item: T) => boolean): Option<T> {
    if (this._len === 0 || !pred(this.buf[this._len - 1])) return Option.None();
    return this.pop();
  }

  /** Like `resize`, but each new slot is filled by calling `make`. */
  public resize_with(new_len: number, make: () => T): void {
    this.check_len(new_len, "resize length");
    if (new_len <= this._len) return this.truncate(new_len);
    this.reserve(new_len - this._len);
    for (let i = this._len; i < new_len; i++) this.buf[i] = make();
    this._len = new_len;
    this._version++;
  }

  /** Appends a clone of every element of `items`. */
  public extend_from_slice(items: Slice<T> | readonly T[]): void {
    const source = items instanceof Slice ? items.to_array() : items;
    for (const item of source) this.push(clone_of(item));
  }

  /** Keeps only the elements for which `keep` returns true, in order. Leaves the Vec unchanged if `keep` throws. */
  public retain(keep: (item: T) => boolean): void {
    const kept: T[] = [];
    for (let i = 0; i < this._len; i++) if (keep(this.buf[i])) kept.push(this.buf[i]);
    this.replace_contents(kept);
  }

  /** Same as `retain`; the predicate may also mutate the elements it is given. */
  public retain_mut(keep: (item: T) => boolean): void {
    this.retain(keep);
  }

  /**
   * Removes consecutive elements that `same` considers equal. `same(current, previous_kept)`
   * returning true removes `current`.
   */
  public dedup_by(same: (current: T, previous: T) => boolean): void {
    const kept: T[] = [];
    for (let i = 0; i < this._len; i++) {
      const item = this.buf[i];
      if (kept.length === 0 || !same(item, kept[kept.length - 1])) kept.push(item);
    }
    this.replace_contents(kept);
  }

  /** Removes consecutive elements whose keys are equal. */
  public dedup_by_key<K>(key: (item: T) => K): void {
    this.dedup_by((a, b) => is_eq(key(a), key(b)));
  }

  /** Removes consecutive repeated elements, compared by value. */
  public dedup(): void {
    this.dedup_by((a, b) => is_eq(a, b));
  }

  /** Writes `kept` over the front of the buffer when it is shorter than the current contents. */
  private replace_contents(kept: T[]): void {
    if (kept.length === this._len) return;
    for (let i = 0; i < kept.length; i++) this.buf[i] = kept[i];
    this._len = kept.length;
    this._version++;
    this.drop_tail();
  }

  /**
   * Removes the elements in `range` and returns them. The removal happens immediately,
   * even if the returned iterator is never consumed. Panics if `range` is out of bounds.
   */
  public drain(range: Range): IterableIterator<T> {
    const [from, to] = resolve_range(range, this._len);
    const removed = this.buf.slice(from, to);
    if (to > from) {
      this.buf.splice(from, to - from);
      this._len -= to - from;
      this._version++;
      this.drop_tail();
    }
    return removed.values();
  }

  /**
   * Replaces the elements in `range` with `items` and returns the removed ones. Like `drain`,
   * the change happens immediately. Panics if `range` is out of bounds.
   */
  public splice(range: Range, items: Iterable<T>): IterableIterator<T> {
    const [from, to] = resolve_range(range, this._len);
    const incoming = [...items];
    const removed = this.buf.slice(from, to);
    if (removed.length === 0 && incoming.length === 0) return removed.values();
    const tail = this.buf.slice(to, this._len);
    const old_len = this._len;
    const new_len = from + incoming.length + tail.length;
    if (new_len > old_len) this.reserve(new_len - old_len);
    let w = from;
    for (const item of incoming) this.buf[w++] = item;
    for (const item of tail) this.buf[w++] = item;
    this._len = new_len;
    this._version++;
    if (new_len < old_len) this.drop_tail();
    return removed.values();
  }

  /** Shrinks the capacity to `max(len, min_capacity)`, if that is smaller than the current one. */
  public shrink_to(min_capacity: number): void {
    this.check_len(min_capacity, "capacity");
    const target = Math.max(this._len, min_capacity);
    if (target < this._capacity) {
      this._capacity = target;
      this.buf.length = target;
    }
  }

  /** Like `reserve`, but returns an Err instead of throwing when the capacity would exceed the engine limit. */
  public try_reserve(additional: number): Result<undefined, string> {
    if (this._len + additional > MAX_ARRAY_LENGTH) return Result.Err("capacity overflow");
    this.reserve(additional);
    return Result.Ok(undefined);
  }

  /** Like `reserve_exact`, but returns an Err instead of throwing when the capacity would exceed the engine limit. */
  public try_reserve_exact(additional: number): Result<undefined, string> {
    if (this._len + additional > MAX_ARRAY_LENGTH) return Result.Err("capacity overflow");
    this.reserve_exact(additional);
    return Result.Ok(undefined);
  }

  /**
   * Creates a consuming iterator, that is, one that moves each value out of the vector
   * (from start to end). The vector is consumed: it cannot be used after calling this.
   *
   * Rust enforces that at compile time. JS cannot, so here the vector is left empty with
   * zero capacity, and the returned iterator owns the elements.
   */
  public into_iter(): IterableIterator<T> {
    return this.take_all().values();
  }

  /**
   * Tries to turn this Vec into a fixed array of exactly `size` elements. The Vec is consumed
   * on success (its elements move into the array and it is left empty). On a length mismatch
   * you get the Vec back, untouched, as the Err.
   */
  public try_into_array<N extends number>(size: N): Result<FixedArray<T, N>, Vec<T>> {
    if (this._len !== size) return Result.Err<FixedArray<T, N>, Vec<T>>(this.outer);
    const items = this.take_all();
    const array = new FixedArray<T, N>(items[0], size);
    array.copy_from_slice(items);
    return Result.Ok<FixedArray<T, N>, Vec<T>>(array);
  }

  /** Moves every element out, leaving an empty Vec with no capacity. */
  private take_all(): T[] {
    const items = this.buf.slice(0, this._len);
    if (this._len > 0) this._version++;
    this._len = 0;
    this._capacity = 0;
    this.buf.length = 0;
    return items;
  }

  public static from_iter<T>(items: Iterable<T>): Vec<T> {
    return Vec.from([...items]);
  }

  public len() {
    return this._len;
  }

  public capacity() {
    return this._capacity;
  }

  /**
   * Shrinks the capacity of the vector down to its active length.
   * Drops excess pre-allocated space instantly without manual loops.
   */
  public shrink_to_fit(): void {
    if (this._capacity > this._len) {
      this._capacity = this._len;

      // Resizing the array length directly prompts the JavaScript engine
      // to deallocate trailing slots and clean memory at the C++ level.
      this.buf.length = this._len;
    }
  }
  /**
   * Reserves capacity for at least additional more elements to be inserted in the given Vec<T>.
   * @note The collection may reserve more space to speculatively avoid frequent reallocations. After calling reserve, capacity will be greater than or equal to self.len() + additional.
   * Prefer {@link Vec#reserve_exact} if you need to reserve exact slots.
   * @note Does nothing if capacity is already sufficient.
   */
  public reserve(additional: number) {
    if (additional <= 0 || !Number.isInteger(additional))
      throw new Error(`Reserve count must be a positive integer`);

    const required_capacity = this._len + additional;

    // only re-allocate if we don't have enough pre-allocated slots.
    if (required_capacity > this._capacity) {
      // re-allocate to either double the capacity or match the exact required capacity
      const doubled_capacity = this._capacity * 2;
      this._capacity = Math.max(doubled_capacity, required_capacity);
      this.buf.length = this._capacity;
    }
  }
  /**
   * Reserves the minimum capacity for at least additional more elements to be inserted in the given Vec<T>.
   * @note Unlike {@link Vec#reserve}, this will not deliberately over-allocate to speculatively avoid frequent allocations. After calling reserve_exact, capacity will be greater than or equal to self.len() + additional.
   * Prefer {@link Vec#reserve_exact} if you future insertions are expected.
   * @note Does nothing if the capacity is already sufficient.
   */
  public reserve_exact(additional: number) {
    if (additional <= 0 || !Number.isInteger(additional))
      throw new Error(`Reserve count must be a positive integer`);

    const required_capacity = this._len + additional;

    if (required_capacity > this._capacity) {
      this._capacity = required_capacity;
      this.buf.length = this._capacity;
    }
  }
}

register_vec_factory((items) => Vec.from(items));

import { clone_of } from "../lib/clone";
import { Option } from "./option";
import { range } from "./range";
import { Slice } from "./slice";

const MAX_ARRAY_LENGTH = 4_294_967_295; // 2^32 - 1

const DEBUG = Symbol.for("nodejs.util.inspect.custom");

export class Vec<T> extends Slice<T> {
  private _capacity: number;

  [DEBUG](_depth: number, options: any, inspect: Function) {
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

    return new Proxy(this_value, {
      get(target, prop) {
        // 1. If looking up an array index (numeric string or number)
        const index = Number(prop);
        if (!Number.isNaN(index) && Number.isInteger(index)) {
          return target
            .get(index)
            .expect(
              `index out of bounds: capacity is ${this_value._capacity} but the index is ${index}`,
            );
        }

        // 2. Delegate to standard class methods (e.g., .len())
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
      set(target, prop, value): boolean {
        const index = Number(prop);
        if (!Number.isNaN(index) && Number.isInteger(index)) {
          target.insert(index, value);
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    }) as any; // Cast to pretend it is a raw tuple alongside our class helper
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
  }

  /**
   * Safe out-of-bounds index lookup protection.
   * Returns Option.Some(T) if the index is valid, otherwise Option.None().
   */
  public get(index: number): Option<T> {
    if (index < 0 || index >= this._len) {
      return Option.None(); // Explicitly returns a structurally matchable None variant
    }
    return Option.Some(this.buf[index] as T);
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

    // Splice shrinks array length by 1. Reset the underlying buffer length
    // back to its true capacity so we don't lose our pre-allocated slots.
    this.buf.length = this._capacity;

    return removedValue as T;
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

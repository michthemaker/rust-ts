import { Option } from "./option";
import { range } from "./range";
import { Slice } from "./slice";

const MAX_ARRAY_LENGTH = 4_294_967_295;
const DEBUG = Symbol.for("nodejs.util.inspect.custom");

export class FixedArray<T, N extends number> extends Slice<T> {
  [DEBUG](_depth: number, options: any, inspect: Function) {
    const formatted_elements = this.buf.map((item) => inspect(item, options));

    return `FixedArray(${this._len})[${formatted_elements.join(", ")}]`;
  }

  constructor(initial_value: T, size: N) {
    if (size > MAX_ARRAY_LENGTH || size < 0)
      throw new Error(
        `Requested allocation on FixedArray<T, N> exceeds engine memory limits.\nMaximum FixedArray<T, N> length is ${MAX_ARRAY_LENGTH} `,
      );
    super(new Array(size).fill(initial_value), 0, size);
    const this_value = this;

    return new Proxy(this_value, {
      get(target, prop) {
        // 1. If looking up an array index (numeric string or number)
        const index = Number(prop);
        if (!Number.isNaN(index) && Number.isInteger(index)) {
          return target
            .safe_get(index)
            .expect(`index out of bounds: length is ${this_value._len} but the index is ${index}`);
        }

        // 2. Delegate to standard class methods (e.g., .len())
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
      set(target, prop, value): boolean {
        const index = Number(prop);
        if (!Number.isNaN(index) && Number.isInteger(index)) {
          target.safe_set(index, value);
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    }) as any; // Cast to pretend it is a raw tuple alongside our class helper
  }

  public static from_fn<T, N extends number>(N: N, f: (index: number) => T) {
    const fixed = new FixedArray<T, N>(undefined as T, N);
    for (let index of range(0, N)) {
      fixed[index] = f(index);
    }
    return fixed;
  }

  private safe_get(index: number): Option<T> {
    if (index < 0 || index >= this._len) {
      return Option.None(); // Safe out-of-bounds protection
    }
    return Option.Some(this.buf[index]);
  }

  private safe_set(index: number, value: T): void {
    if (index < 0 || index >= this._len) {
      throw new Error(`index out of bounds: length is ${this._len} but the index is ${index}`);
    }
    this.buf[index] = value;
  }

  public len(): N {
    return this._len as N;
  }

  public to_array() {
    return this.buf.slice(0, this._len);
  }
}

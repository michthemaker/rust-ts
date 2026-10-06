import { Option } from "./option";

class FixedArrayConstructorImpl<T, N extends number> {
  private buffer: T[];
  private size: N;

  constructor(initial_value: T, size: N) {
    this.size = size;
    this.buffer = new Array(size).fill(initial_value);
    const this_value = this;

    return new Proxy(this_value, {
      get(target, prop) {
        // 1. If looking up an array index (numeric string or number)
        const index = Number(prop);
        if (!Number.isNaN(index) && Number.isInteger(index)) {
          return target
            .safe_get(index)
            .expect(`index out of bounds: length is ${this_value.size} but the index is ${index}`);
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
  private safe_get(index: number): Option<T> {
    if (index < 0 || index >= this.size) {
      return Option.None(); // Safe out-of-bounds protection
    }
    return Option.Some(this.buffer[index]);
  }

  private safe_set(index: number, value: T): void {
    if (index < 0 || index >= this.size) {
      throw new Error(`index out of bounds: length is ${this.size} but the index is ${index}`);
    }
    this.buffer[index] = value;
  }

  public len(): number {
    return this.size;
  }
}

type TupleToIndices<Tuple extends any[]> = {
  [Index in Extract<keyof Tuple, `${number}`>]: Tuple[Index];
};

type FixedIndices<T, N extends number, R extends T[] = []> = R["length"] extends N
  ? R
  : FixedIndices<T, N, [T, ...R]>;

type FixedArray<T, N extends number> = TupleToIndices<FixedIndices<T, N>> &
  FixedArrayConstructorImpl<T, N>;

interface FixedArrayConstructor {
  new <T, N extends number>(initial_value: T, size: N): FixedArray<T, N>;
}

const FixedArray = FixedArrayConstructorImpl as unknown as FixedArrayConstructor;

export { FixedArray };

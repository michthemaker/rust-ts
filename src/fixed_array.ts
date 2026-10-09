import { is_equal } from "../lib/is_equal";
import { define_pattern, Pattern } from "./match";
import { Option } from "./option";
import { FixedArray as Impl } from "./fixed_array_impl";

type TupleToIndices<Tuple extends any[]> = {
  [Index in Extract<keyof Tuple, `${number}`>]: Tuple[Index];
};

type FixedIndices<T, N extends number, R extends T[] = []> = R["length"] extends N
  ? R
  : FixedIndices<T, N, [T, ...R]>;

type FixedArray<T, N extends number> = TupleToIndices<FixedIndices<T, N>> & Impl<T, N>;

interface FixedArrayConstructor {
  new <T, N extends number>(initial_value: T, size: N): FixedArray<T, N>;
}

const FixedArray = Impl as unknown as FixedArrayConstructor;

declare module "./match" {
  interface PatternKinds<T> {
    "rust-ts::std::FixedArray<T, N>": [T];
  }
  interface PatternInterface {
    FixedArray<T>(expected: T[]): Pat<"rust-ts::std::FixedArray<T, N>">;
  }
}

Pattern.FixedArray = function (expected) {
  return define_pattern("rust-ts::std::FixedArray<T, N>", (subject: any) => {
    if (subject && subject instanceof Impl) {
      const current = subject.to_array();
      if (is_equal(current, expected)) return Option.Some([subject]);
    }
    return Option.None();
  });
};

export { FixedArray };

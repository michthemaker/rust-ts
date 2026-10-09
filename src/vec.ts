import { Option } from "./option";
import { define_pattern, Pattern } from "./match";
import { is_equal } from "../lib/is_equal";
import { Vec as Impl } from "./vec_impl";

// Numeric Indexable<T> interface
interface Vec<T> extends Impl<T> {}

interface VecConstructor {
  new: <T>() => Vec<T>;
  with_capacity: <T>(capacity: number) => Vec<T>;
}

const Vec = Impl as unknown as VecConstructor;

const vec = function vec<T>(arr: Array<T>): Vec<T> {
  // @ts-ignore
  return Vec.from(arr);
};

declare module "./match" {
  interface PatternKinds<T> {
    "rust-ts::std::Vec<T>": T extends Vec<infer X> ? [X[]] : never;
  }
  interface PatternInterface {
    Vec<T>(expected: T[]): Pat<"rust-ts::std::Vec<T>">;
  }
}

Pattern.Vec = function (expected) {
  return define_pattern("rust-ts::std::Vec<T>", (subject: any) => {
    if (subject && subject instanceof Impl) {
      const current = subject.to_array();
      if (is_equal(current, expected)) return Option.Some([current]);
    }
    return Option.None();
  });
};

export { Vec, vec };

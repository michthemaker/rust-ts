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

/** `vec![]` */
function vec<T>(): Vec<T>;
/** `vec![0, 0, 0]` */
function vec<T>(array: Array<T>): Vec<T>;
/** `vec![elem; n]`: n elements, each a clone of `value` (the last one is `value` itself). */
function vec<T>(elem: T, n: number): Vec<T>;

function vec(arg1?: any, arg2?: any) {
  if (arg2) {
    if (!Number.isInteger(arg2))
      throw new Error(`vec(elem, n): n must be a non-negative integer, got ${arg2}`);
    // @ts-ignore
    return Vec.from_elem(arg1, arg2);
  } else if (arg1)
    // @ts-ignore
    return Vec.from(arg1);
  // @ts-ignore
  else return Vec.from([]);
}

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

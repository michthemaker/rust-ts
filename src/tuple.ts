import { Clone } from "./clone";
import { PartialEq } from "./cmp";
import { TraitInstance } from "./trait";
import { Tuple as Impl } from "./tuple_impl";

/** "0", "1", ... only: the explicit positions, each with its own type */
type Indices<T extends readonly unknown[]> = {
  [K in Extract<keyof T, `${number}`>]: T[K];
};

/** every other array member stays in the type, because destructuring needs it, but is `never`, so using it is an error */
type OtherMembers<T extends readonly unknown[]> = {
  readonly [K in Exclude<keyof T, `${number}` | number>]: K extends typeof Symbol.iterator
    ? T[K]
    : never;
};

interface Traits<T extends readonly unknown[]>
  extends TraitInstance<typeof Clone<Tuple<T>>>, TraitInstance<typeof PartialEq<Tuple<T>>> {}

export type Tuple<T extends readonly unknown[]> = Indices<T> & OtherMembers<T> & Traits<T>;

export function Tuple<const T extends unknown[]>(...args: T): Tuple<T> {
  return new Impl(args) as unknown as Tuple<T>;
}

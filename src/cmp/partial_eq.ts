export interface PartialEq<T> {
  eq(other: T): boolean;
  ne(other: T): boolean;
}

import { clone_of } from "../lib/clone";

export function derive_clone<T extends object>(self: T): T {
  const copy = Object.create(Object.getPrototypeOf(self));
  for (const [k, v] of Object.entries(self)) copy[k] = clone_of(v); // deep, via the same helper
  return copy;
}

interface Clone {
  clone(): this;
}
export function is_clone(x: any): x is Clone {
  return typeof x?.clone === "function";
}

export function clone_of<T>(x: T): T {
  if (x === null || typeof x !== "object") return x; // primitives and functions as-is
  if (is_clone(x)) return x.clone() as T; // your own types
  if (Array.isArray(x)) return x.map(clone_of) as T;
  if (x instanceof Date) return new Date(x) as T;
  if (x instanceof Map) return new Map([...x].map(([k, v]) => [k, clone_of(v)])) as T;
  if (x instanceof Set) return new Set([...x].map(clone_of)) as T;
  if (Object.getPrototypeOf(x) === Object.prototype)
    // plain object only
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, clone_of(v)])) as T;
  // return x; // other class instances: shared, like Rc
  throw new Error(
    `the trait bound \`${(x as any).constructor?.name ?? "object"}: Clone\` is not satisfied`,
  );
}

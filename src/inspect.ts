// inspect.ts
import { FMT, FmtOptions } from "./fmt";

export type Inspect = (value: unknown, options?: FmtOptions) => string;

const node_inspect: Inspect | undefined = (() => {
  const get_builtin = (globalThis as any).process?.getBuiltinModule; // Node 22.3+ and Bun
  const util = typeof get_builtin === "function" ? get_builtin("node:util") : undefined;
  if (!util?.inspect) return undefined;
  return (value, options) =>
    util.inspect(value, { colors: false, depth: Infinity, breakLength: Infinity, ...options });
})();

function polyfill(
  value: unknown,
  options: FmtOptions = {},
  depth = 0,
  seen = new Set<object>(),
): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "bigint":
      return `${value}n`;
    case "number":
      return Object.is(value, -0) ? "-0" : String(value);
    case "boolean":
    case "undefined":
    case "symbol":
      return String(value);
    case "function":
      return `[Function: ${value.name || "anonymous"}]`;
  }

  const obj = value as any;
  // the same protocol Node uses: call FMT with (depth, options, inspect)
  if (typeof obj[FMT] === "function")
    return obj[FMT](depth, options, (v: unknown, o?: FmtOptions) =>
      polyfill(v, { ...options, ...o }, depth + 1, seen),
    );

  if (seen.has(obj)) return "[Circular]";
  if (depth > (options.depth ?? 2)) return Array.isArray(obj) ? "[Array]" : "[Object]";
  seen.add(obj);
  try {
    const next = (v: unknown) => polyfill(v, options, depth + 1, seen);
    if (obj instanceof Date) return obj.toISOString();
    if (obj instanceof Error) return obj.stack ?? `${obj.name}: ${obj.message}`;
    if (Array.isArray(obj)) return `[${obj.map(next).join(", ")}]`;
    if (obj instanceof Map)
      return `Map(${obj.size}) {${[...obj].map(([k, v]) => `${next(k)} => ${next(v)}`).join(", ")}}`;
    if (obj instanceof Set) return `Set(${obj.size}) {${[...obj].map(next).join(", ")}}`;
    const name = obj.constructor?.name;
    const body = Object.keys(obj)
      .map((k) => `${k}: ${next(obj[k])}`)
      .join(", ");
    return `${name && name !== "Object" ? name + " " : ""}{${body}}`;
  } finally {
    seen.delete(obj);
  }
}

/** one inspect for the whole library: Node's where it exists, the polyfill elsewhere */
export const inspect: Inspect = node_inspect ?? ((value, options) => polyfill(value, options));

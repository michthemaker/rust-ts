import { impls, trait } from "./trait_impl.ts";

export function clone_of<T>(x: T): T {
	if (x === null || typeof x !== "object") return x; // primitives and functions as-is
	if (impls(x, Clone)) return x.clone() as T; // your own types
	if (Array.isArray(x)) return x.map(clone_of) as T;
	if (x instanceof Date) return new Date(x) as T;
	if (x instanceof Map) return new Map([...x].map(([k, v]) => [k, clone_of(v)])) as T;
	if (x instanceof Set) return new Set([...x].map(clone_of)) as T;
	if (Object.getPrototypeOf(x) === Object.prototype)
		// plain object only
		return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, clone_of(v)])) as T;
	// let's give other user classes a chance.
	return derive_clone(x);
	// throw new Error(
	// 	`the trait bound \`${(x as any).constructor?.name ?? "object"}: Clone\` is not satisfied`
	// );
}

export function derive_clone<T extends object>(self: T): T {
	const copy = Object.create(Object.getPrototypeOf(self));
	for (const [k, v] of Object.entries(self)) copy[k] = clone_of(v); // deep, via the same helper
	return copy;
}

export const Clone = <T>() =>
	trait((b) => {
		abstract class Clone extends b {
			abstract clone(): T;
			protected constructor(...args: any[]) {
				super(...args);
			}
		}
		return Clone;
	});

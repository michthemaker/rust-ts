import { AsyncDrop, Drop } from "./ops.ts";
import { impls, type TraitInstance } from "./trait_impl.ts";

/**
 * Disposes of a synchronous value.
 * calling `[Symbol.dispose]()` on it
 */
export function drop<T extends TraitInstance<typeof Drop>>(resource: T): void {
	if (impls(resource, AsyncDrop)) {
		throw new Error("cannot synchronously drop an asynchronous resource. Use async_drop instead.");
	}

	if (impls(resource, Drop)) {
		return resource[Symbol.dispose]();
	}

	const type_name = (resource as any)?.constructor?.name ?? typeof resource;
	throw new Error(`the trait bound \`${type_name}: Drop\` is not satisfied`);
}

/**
 * Disposes of an asynchronous value.
 * calling `[Symbol.asyncDispose]()` on it
 * @remarks the value should be awaited.
 * @example
 * ``typescript
 * await async_drop(my_async_value);
 * ``
 */
export async function async_drop<T extends TraitInstance<typeof AsyncDrop>>(
	resource: T
): Promise<void> {
	if (impls(resource, AsyncDrop)) {
		return await resource[Symbol.asyncDispose]();
	}

	const type_name = (resource as any)?.constructor?.name ?? typeof resource;
	throw new Error(`the trait bound \`${type_name}: AsyncDrop\` is not satisfied`);
}

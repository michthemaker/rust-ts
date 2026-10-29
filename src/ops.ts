import { trait } from "./trait_impl.ts";

export const Drop = trait((b) => {
	abstract class Drop extends b {
		declare static readonly __instance: Drop;
		abstract [Symbol.dispose](): void;
		protected constructor(...args: any[]) {
			super(...args);
		}
	}
	return Drop;
});

export const AsyncDrop = trait((b) => {
	abstract class AsyncDrop extends b {
		declare static readonly __instance: AsyncDrop;
		abstract [Symbol.asyncDispose](): Promise<void>;
		protected constructor(...args: any[]) {
			super(...args);
		}
	}
	return AsyncDrop;
});

export const CONTAINER = Symbol.for("rust-ts.Container");

/** Marks a type whose dispose forwards to the values it owns. Not in Rust: there it's automatic (drop glue). */
export const Container = trait((b) => {
	abstract class Container extends b {
		declare static readonly __instance: Container;
		[CONTAINER] = true as const;
		protected constructor(...args: any[]) {
			super(...args);
		}
	}
	return Container;
});

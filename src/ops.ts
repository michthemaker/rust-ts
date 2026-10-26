import { trait } from "./trait_impl.ts";

export const Drop = trait((b) => {
	abstract class Drop extends b {
		abstract [Symbol.dispose](): void;
		protected constructor(...args: any[]) {
			super(...args);
		}
	}
	return Drop;
});

export const AsyncDrop = trait((b) => {
	abstract class AsyncDrop extends b {
		abstract [Symbol.asyncDispose](): Promise<void>;
		protected constructor(...args: any[]) {
			super(...args);
		}
	}
	return AsyncDrop;
});

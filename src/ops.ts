import { trait } from "./trait_impl.ts";

export const Drop = trait((b) => {
	abstract class Drop extends b {
		abstract [Symbol.dispose](): void;
		// @ts-ignore
		// oxlint-disable-next-line no-unused-vars
		protected constructor(...args: any[]) {
			super();
		}
	}
	return Drop;
});

export const AsyncDrop = trait((b) => {
	abstract class AsyncDrop extends b {
		abstract [Symbol.asyncDispose](): Promise<void>;
		// @ts-ignore
		// oxlint-disable-next-line no-unused-vars
		protected constructor(...args: any[]) {
			super();
		}
	}
	return AsyncDrop;
});

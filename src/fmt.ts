import { trait } from "./trait_impl.ts";

export const Debug = trait((b) => {
	abstract class Debug extends b {
		abstract [FMT](
			depth: number,
			options: FmtOptions,
			inspect: (arg: any, options: FmtOptions) => string
		): string;
		// @ts-ignore
		// oxlint-disable-next-line no-unused-vars
		protected constructor(...args: any[]) {
			super();
		}
	}
	return Debug;
});

export type FmtOptions = {
	/**
	 * Whether to colorize the output
	 */
	colors?: boolean;
	/**
	 * The depth of the inspection
	 */
	depth?: number;
};

export const FMT = Symbol.for("nodejs.util.inspect.custom");

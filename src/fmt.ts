import { trait } from "./trait_impl.ts";

export const Debug = trait((b) => {
	abstract class Debug extends b {
		declare static readonly __instance: Debug;
		abstract [FMT](
			depth: number,
			options: FmtOptions,
			inspect: (arg: any, options: FmtOptions) => string
		): string;
		protected constructor(...args: any[]) {
			super(...args);
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

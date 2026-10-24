import { type Prettify } from "./types.ts";

export const pick = <O extends Record<string, any>, K extends keyof O>(obj: O, ...keys: K[]) => {
	const emptyObj = {} as Record<K, any>;
	keys.forEach((k) => (emptyObj[k] = obj[k]));
	return emptyObj as Prettify<Pick<O, K>>;
};

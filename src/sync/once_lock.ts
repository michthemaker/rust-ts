import type { DropCheck, Msg } from "../../lib/types";
import { OnceLock as Impl } from "./once_lock_impl.ts";

type Thenable = { then: (...args: any[]) => any };

type NotThenable<T> = [T] extends [Thenable]
	? Msg<"OnceLock<T>: T cannot be a Thenable value. Await it and store the resolved value">
	: unknown;

interface OnceLock<T extends DropCheck<T> & NotThenable<T>> extends Impl<T> {}

interface OnceLockConstructor {
	new <T extends DropCheck<T> & NotThenable<T>>(): DropCheck<T> extends Msg<any>
		? never
		: NotThenable<T> extends Msg<any>
			? never
			: OnceLock<T>;
}

const OnceLock = Impl as unknown as OnceLockConstructor;

export { OnceLock };

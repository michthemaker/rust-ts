import { is_iterable } from "../lib/iterable.ts";
import { clone_of } from "./clone.ts";
import { FMT } from "./fmt.ts";
import { AsyncDrop, Drop } from "./ops.ts";
import { range } from "./range.ts";
import { Slice } from "./slice_impl.ts";
import { impl, impls } from "./trait_impl.ts";
import { Vec, vec } from "./vec.ts";

const MAX_ARRAY_LENGTH = 4_294_967_295;
const INDEX = /^(0|[1-9]\d*)$/;

function panic(msg: string): never {
	throw new Error(msg);
}

export class FixedArray<T, N extends number> extends impl(Drop, AsyncDrop, Slice)<T> {
	[FMT](_depth: number, options: any, inspect: Function) {
		const formatted_elements = this.buf.map((item) => inspect(item, options));
		return `FixedArray(${this._len})[${formatted_elements.join(", ")}]`;
	}

	[Symbol.dispose]!: () => void;
	[Symbol.asyncDispose]!: () => Promise<void>;

	constructor(initial_value: T, size: N) {
		if (size > MAX_ARRAY_LENGTH || size < 0)
			throw new Error(
				`Requested allocation on FixedArray<T, N> exceeds engine memory limits.\nMaximum FixedArray<T, N> length is ${MAX_ARRAY_LENGTH} `
			);
		const arr = new Array(size);
		for (let i = 0; i < size - 1; i++) {
			arr[i] = clone_of(initial_value);
		}
		arr[size - 1] = initial_value;
		super(arr, 0, size);
		const this_value = this;
		let dropped = false;

		const is_dispose = (p: PropertyKey) => p === Symbol.dispose || p === Symbol.asyncDispose;
		// keys that tooling touches implicitly; everything else string-keyed panics after drop
		const ALLOWED_AFTER_DROP = new Set<PropertyKey>(["constructor", "then"]);

		const finish = (errors: unknown[]) => {
			if (errors.length === 1) throw errors[0];
			if (errors.length > 1)
				throw new AggregateError(errors, "multiple errors while dropping FixedArray<T, N>");
		};

		this[Symbol.dispose] = () => {
			if (dropped) panic(`use of dropped value: FixedArray<T, N>`);

			// pass 1: validate only, nothing is mutated if this panics.
			// mirrors mem.drop: an AsyncDrop item is only OK if it is iterable AND also Drop
			for (let i = 0; i < this._len; i++) {
				const item = this.buf[this.start + i];
				if (impls(item, AsyncDrop) && !(is_iterable(item) && impls(item, Drop))) {
					panic("cannot synchronously drop an asynchronous resource. Use async_drop instead.");
				}
			}

			dropped = true;

			// pass 2: drop in order, keep going past failures
			const errors: unknown[] = [];
			for (let i = 0; i < this._len; i++) {
				const item = this.buf[this.start + i];
				try {
					if (impls(item, Drop)) item[Symbol.dispose]();
				} catch (e) {
					errors.push(e);
				}
			}
			this.buf.length = 0;
			finish(errors);
		};
		this[Symbol.asyncDispose] = async () => {
			if (dropped) panic(`use of dropped value: FixedArray<T, N>`);
			dropped = true; // set before awaiting so concurrent use panics too

			const errors: unknown[] = [];
			for (let i = 0; i < this._len; i++) {
				const item = this.buf[this.start + i];
				try {
					if (impls(item, AsyncDrop)) await item[Symbol.asyncDispose]();
					else if (impls(item, Drop)) item[Symbol.dispose]();
				} catch (e) {
					errors.push(e);
				}
			}
			this.buf.length = 0;
			finish(errors);
		};

		return new Proxy(this_value, {
			get(target, prop) {
				if (dropped) {
					if (is_dispose(prop)) panic(`cannot drop a dropped value: FixedArray<T, N>`);
					if (typeof prop === "string" && !ALLOWED_AFTER_DROP.has(prop))
						panic(`use of dropped value: FixedArray<T, N>`);
					// other symbols (inspect, toPrimitive, iterator probes...) fall through
				}
				if (typeof prop === "string" && INDEX.test(prop)) {
					const index = Number(prop);
					if (index >= target._len)
						panic(`index out of bounds: the len is ${target._len} but the index is ${index}`);
					return target.buf[target.start + index];
				}
				const value = Reflect.get(target, prop);
				// arrow-function dispose methods ignore bind; harmless for them
				return typeof value === "function" ? (value as Function).bind(target) : value;
			},
			set(target, prop, value): boolean {
				if (dropped) {
					if (is_dispose(prop)) panic(`cannot drop a dropped value: FixedArray<T, N>`);
					if (typeof prop === "string") panic(`use of dropped value: FixedArray<T, N>`);
				}
				if (typeof prop === "string" && INDEX.test(prop)) {
					const index = Number(prop);
					if (index >= target._len)
						panic(`index out of bounds: the len is ${target._len} but the index is ${index}`);
					target.buf[target.start + index] = value;
					return true;
				}
				return Reflect.set(target, prop, value);
			},
			deleteProperty() {
				return false;
			}
		}) as any;
	}

	public static from_fn<T, N extends number>(N: N, f: (index: number) => T) {
		const fixed = new FixedArray<T, N>(undefined as T, N);
		for (let index of range(0, N)) {
			fixed[index] = f(index);
		}
		return fixed;
	}

	public len(): N {
		return this._len as N;
	}

	public to_array() {
		return this.buf.slice(0, this._len);
	}

	public to_vec() {
		// a slice is created internally
		return vec(this.buf);
	}

	// array only transform
	public map<U>(f: MapTransformFn<T, U>) {
		const new_fixed = new FixedArray<U, N>(undefined as U, this._len as N);
		for (let i of range(0, this._len)) {
			new_fixed[i] = f(this.buf[i], i);
		}
		return new_fixed;
	}

	public eq(other: Slice<T>): boolean;
	public eq(other: T[]): boolean;
	public eq(other: FixedArray<T, number>): boolean;
	public eq(other: Vec<T>): boolean;
	eq(other: any): boolean {
		return super.eq(other);
	}

	public clone() {
		const copy = new FixedArray<T, N>(undefined as T, this._len as N);
		for (let i of range(0, this._len)) {
			const item = this.buf[i];
			copy[i] = clone_of(item);
		}
		return copy;
	}
}

type MapTransformFn<T, U> = (v: T, index: number) => U;

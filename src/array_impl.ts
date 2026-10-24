import { clone_of } from "./clone.ts";
import { FMT } from "./fmt.ts";
import { range } from "./range.ts";
import { Slice } from "./slice.ts";
import { Vec, vec } from "./vec.ts";

const MAX_ARRAY_LENGTH = 4_294_967_295;
const INDEX = /^(0|[1-9]\d*)$/;

function panic(msg: string): never {
	throw new Error(msg);
}

export class FixedArray<T, N extends number> extends Slice<T> {
	[FMT](_depth: number, options: any, inspect: Function) {
		const formatted_elements = this.buf.map((item) => inspect(item, options));

		return `FixedArray(${this._len})[${formatted_elements.join(", ")}]`;
	}

	constructor(initial_value: T, size: N) {
		if (size > MAX_ARRAY_LENGTH || size < 0)
			throw new Error(
				`Requested allocation on FixedArray<T, N> exceeds engine memory limits.\nMaximum FixedArray<T, N> length is ${MAX_ARRAY_LENGTH} `
			);
		super(new Array(size).fill(initial_value), 0, size);
		const this_value = this;

		return new Proxy(this_value, {
			get(target, prop) {
				if (typeof prop === "string" && INDEX.test(prop)) {
					const index = Number(prop);
					if (index >= target._len)
						panic(`index out of bounds: the len is ${target._len} but the index is ${index}`);
					return target.buf[target.start + index];
				}
				const value = Reflect.get(target, prop);
				return typeof value === "function" ? (value as Function).bind(target) : value;
			},
			set(target, prop, value): boolean {
				if (typeof prop === "string" && INDEX.test(prop)) {
					const index = Number(prop);
					if (index >= target._len)
						panic(`index out of bounds: the len is ${target._len} but the index is ${index}`);
					target.buf[target.start + index] = value;
					return true;
				}
				return Reflect.set(target, prop, value);
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

	/**
	 * Do not call this. FixedArray doesn't implement Default trait
	 */
	static default(): any {
		throw new Error(`FixedArray doesn't implement Default trait`);
	}
}

type MapTransformFn<T, U> = (v: T, index: number) => U;

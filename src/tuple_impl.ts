import { clone_of, Clone } from "./clone.ts";
import { is_eq, PartialEq } from "./cmp.ts";
import { Debug, FMT, type FmtOptions } from "./fmt.ts";
import { impl, impls } from "./trait_impl.ts";
import { AsyncDrop, Container, Drop } from "./ops.ts";
function panic(msg: string): never {
	throw new Error(msg);
}

const INDEX = /^(0|[1-9]\d*)$/;
const MOVED = Symbol("rust-ts.tuple.moved"); // private sentinel, compared by identity

type State = { buf: unknown[]; dropped: boolean };
/** proxy AND raw target -> shared state (don't export in the real file) */
const STATE = new WeakMap<object, State>();

function live(v: unknown): State {
	const s = STATE.get(v as object);
	if (!s) panic("not a Tuple");
	if (s.dropped) panic("use of dropped value: Tuple");
	return s;
}
function whole(s: State): void {
	if (s.buf.includes(MOVED)) panic("use of partially moved value: Tuple");
}
function finish(errors: unknown[]): void {
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1) throw new AggregateError(errors, "multiple errors while dropping Tuple");
}

export class Tuple extends impl(Debug, Clone, PartialEq<Tuple>, Container, Drop, AsyncDrop) {
	constructor(args: unknown[]) {
		super();
		const state: State = { buf: [...args], dropped: false };
		STATE.set(this, state);
		const proxy = new Proxy(this, {
			get(target, prop) {
				if (typeof prop === "string" && INDEX.test(prop)) {
					if (state.dropped) panic("use of dropped value: Tuple");
					const i = Number(prop);
					if (i >= state.buf.length)
						panic(`index out of bounds: the len is ${state.buf.length} but the index is ${i}`);
					const v = state.buf[i];
					if (v === MOVED) panic(`use of moved value: Tuple.${i}`);
					return v; // index reads never move
				}
				const value = Reflect.get(target, prop);
				return typeof value === "function" ? (value as Function).bind(target) : value;
			},
			set(_t, prop) {
				throw new TypeError(`Cannot assign to read-only property '${String(prop)}' of Tuple`);
			},
			deleteProperty() {
				return false;
			}
		});
		STATE.set(proxy, state);
		return proxy;
	}

	/** destructuring is the move: each slot is emptied as it is yielded */
	*[Symbol.iterator](): IterableIterator<any> {
		const s = live(this);
		for (let i = 0; i < s.buf.length; i++) {
			if (s.dropped) panic("use of dropped value: Tuple");
			const v = s.buf[i];
			if (v === MOVED) panic(`use of moved value: Tuple.${i}`);
			s.buf[i] = MOVED;
			yield v;
		}
	}

	eq(other: unknown): boolean {
		const a = live(this);
		const b = STATE.get(other as object);
		if (!b) return false;
		if (b.dropped) panic("use of dropped value: Tuple");
		whole(a);
		whole(b);
		return a.buf.length === b.buf.length && a.buf.every((x, i) => is_eq(x, b.buf[i]));
	}
	ne(other: unknown): boolean {
		return !this.eq(other);
	}

	clone(): Tuple {
		const s = live(this);
		whole(s);
		return new Tuple(s.buf.map((v) => clone_of(v)));
	}

	[FMT](
		_depth: number,
		options: FmtOptions,
		inspect: (arg: any, options: FmtOptions) => string
	): string {
		const s = STATE.get(this)!;
		if (s.dropped) return "(<dropped>)";
		return `(${s.buf.map((v) => (v === MOVED ? "<moved>" : inspect(v, options))).join(", ")})`;
	}

	[Symbol.dispose](): void {
		const s = STATE.get(this)!;
		if (s.dropped) panic("cannot drop a dropped value: Tuple");
		for (const v of s.buf) {
			// pass 1: validate only, refuse before consuming anything
			if (v !== MOVED && impls(v, AsyncDrop) && !(impls(v, Drop) && impls(v, Container)))
				panic("cannot synchronously drop an asynchronous resource. Use async_drop instead.");
		}
		s.dropped = true;
		const items = s.buf.slice();
		s.buf.length = 0;
		const errors: unknown[] = [];
		for (const v of items) {
			// index order, moved-out slots skipped
			if (v === MOVED) continue;
			try {
				if (impls(v, Drop)) (v as any)[Symbol.dispose]();
			} catch (e) {
				errors.push(e);
			}
		}
		finish(errors);
	}

	async [Symbol.asyncDispose](): Promise<void> {
		const s = STATE.get(this)!;
		if (s.dropped) panic("cannot drop a dropped value: Tuple");
		s.dropped = true; // before awaiting, so a concurrent drop panics
		const items = s.buf.slice();
		s.buf.length = 0;
		const errors: unknown[] = [];
		for (const v of items) {
			if (v === MOVED) continue;
			try {
				if (impls(v, AsyncDrop)) await (v as any)[Symbol.asyncDispose]();
				else if (impls(v, Drop)) (v as any)[Symbol.dispose]();
			} catch (e) {
				errors.push(e);
			}
		}
		finish(errors);
	}
}

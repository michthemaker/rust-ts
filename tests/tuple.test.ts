import { describe, test, expect, beforeEach } from "bun:test";
import { Tuple } from "../src/lang/index.ts";
import { impl, impls } from "../src/trait_impl.ts";
import { AsyncDrop, Container, Drop } from "../src/ops.ts";
import { format } from "../src/format_impl.ts";
import { async_drop, drop } from "../src/mem.ts";

// ---- helpers (adapt to your API) ----
const T = Tuple; // public factory
let log: string[];
beforeEach(() => {
	log = [];
});

class Conn extends impl(Drop) {
	constructor(public id: any) {
		super();
	}
	[Symbol.dispose]() {
		log.push(`conn ${this.id}`);
	}
}
class Boom extends impl(Drop) {
	constructor(public id: any) {
		super();
	}
	[Symbol.dispose]() {
		log.push(`boom ${this.id}`);
		throw new Error(`boom ${this.id}`);
	}
}
class Sock extends impl(AsyncDrop) {
	async [Symbol.asyncDispose]() {
		log.push("sock");
	}
}

const fmt = format;

describe("Tuple: basics", () => {
	test("index reads work and never move", () => {
		const t = T(10, "x");
		expect(t[0]).toBe(10);
		expect(t[0]).toBe(10); // second read still fine
		expect(t[1]).toBe("x");
	});
	test("out of bounds panics with len and index", () => {
		expect(() => T(1, 2)[2]).toThrow(/index out of bounds: the len is 2 but the index is 2/);
	});
	test("read-only", () => {
		const t = T(10, "x");
		expect(() => {
			// @ts-expect-error
			t[0] = 5;
		}).toThrow(/read-only/);
	});
	test("instanceof Tuple, no own keys leak", () => {
		expect(T(1) instanceof Tuple).toBe(true);
		expect(Object.keys(T(1))).toEqual([]);
	});
});

describe("Tuple: proxy / WeakMap identity (the earlier bug)", () => {
	test("methods work when `other` is a proxy", () => {
		expect(T(1, 2).eq(T(1, 2))).toBe(true);
	});
	test("clone returns a usable proxy", () => {
		const t = T(1, 2),
			c = t.clone();
		expect(c).not.toBe(t);
		expect(c.eq(t)).toBe(true);
	});
	// optional, not worth keeping in the repo: a throwaway class showing a WeakSet keyed by
	// the constructor's raw `this` is not found from the proxy or from the handler's `this`
});

describe("Tuple: destructuring moves", () => {
	test("full destructure empties every yielded slot", () => {
		const t = T(1, 2);
		const [a, b] = t;
		expect([a, b]).toEqual([1, 2]);
		expect(() => t[0]).toThrow(/use of moved value: Tuple.0/);
		expect(() => t[1]).toThrow(/use of moved value: Tuple.1/);
		expect(fmt("{:?}", t)).toBe("(<moved>, <moved>)");
	});
	test("partial destructure leaves the rest owned", () => {
		const t = T(1, 2, 3);
		const [_a] = t;
		expect(() => t[0]).toThrow(/moved/);
		expect(t[1]).toBe(2);
		expect(t[2]).toBe(3);
		expect(fmt("{:?}", t)).toBe("(<moved>, 2, 3)");
	});
	test("early break empties only yielded slots", () => {
		const t = T("a", "b");
		for (const _ of t) break;
		expect(() => t[0]).toThrow(/moved/);
		expect(t[1]).toBe("b");
	});
	test("rest pattern gives a plain array and empties the slots", () => {
		// add: not covered before
		const t = T(1, 2, 3);
		const [_a, ...rest] = t;
		expect(Array.isArray(rest)).toBe(true);
		expect(() => t[2]).toThrow(/moved/);
	});
});

describe("Tuple: eq / ne / clone", () => {
	test("eq and ne", () => {
		expect(T(1, "a").eq(T(1, "a"))).toBe(true);
		expect(T(1).eq(T(2))).toBe(false);
		expect(T(1).ne(T(2))).toBe(true);
		// @ts-ignore
		expect(T(1).eq([1])).toBe(false); // not a Tuple
		expect(T(T(1)).eq(T(T(1)))).toBe(true); // nested
	});
	test("partially moved tuple panics on eq / ne / clone, on either side", () => {
		const t = T(1, 2);
		const [_a] = t;
		expect(() => t.eq(T(1, 2))).toThrow(/partially moved/);
		expect(() => T(1, 2).eq(t)).toThrow(/partially moved/);
		expect(() => t.ne(T(1, 2))).toThrow(/partially moved/);
		expect(() => t.clone()).toThrow(/partially moved/);
	});
	test("clone is independent", () => {
		const t = T(1, 2),
			u = t.clone();
		const [_x, _y] = u;
		expect(t[0]).toBe(1);
		expect(t[1]).toBe(2); // original untouched
		expect(() => u[0]).toThrow(/moved/);
	});
});

describe("Tuple: Drop", () => {
	test("index order, consumed afterwards, placeholder", () => {
		const t = T(new Conn(0), 5, new Conn(2));
		drop(t);
		expect(log).toEqual(["conn 0", "conn 2"]);
		expect(() => drop(t)).toThrow(/cannot drop a dropped value/);
		expect(() => t[0]).toThrow(/use of dropped value/);
		expect(fmt("{:?}", t)).toBe("(<dropped>)");
	});
	test("moved-out slots are skipped (no double dispose)", () => {
		// the motivating case
		const t = T(new Conn(0), new Conn(1));
		const [x] = t;
		drop(x);
		drop(t);
		expect(log).toEqual(["conn 0", "conn 1"]);
	});
	test("a throwing element does not stop the others", () => {
		const t = T(new Conn(0), new Boom(1), new Conn(2));
		expect(() => drop(t)).toThrow(/boom 1/);
		expect(log).toEqual(["conn 0", "boom 1", "conn 2"]);
		expect(() => drop(t)).toThrow(/cannot drop a dropped value/);
	});
	test("several throwing elements give an AggregateError", () => {
		const t = T(new Boom(0), new Boom(1));
		try {
			drop(t);
			throw "unreachable";
		} catch (e) {
			expect(e).toBeInstanceOf(AggregateError);
			expect((e as any).errors.length).toBe(2);
		}
	});
	test("async-only element: sync drop refuses atomically", () => {
		const t = T(new Conn(0), new Sock());
		expect(() => drop(t)).toThrow(/cannot synchronously drop/);
		expect(log).toEqual([]); // nothing consumed
		expect(t[0].id).toBe(0); // still usable
	});
});

describe("Tuple: AsyncDrop", () => {
	test("async drop rescues the tuple a sync drop refused", async () => {
		const t = T(new Conn(0), new Sock());
		expect(() => drop(t)).toThrow(/drop an asynchronous/i);
		console.log(t);
		// the next line fails, see the left side
		await async_drop(t);
		console.log(t);
		expect(log).toEqual(["conn 0", "sock"]);
		expect(async_drop(t)).rejects.toThrow(/cannot drop a dropped value/);
	});
	test("moved slots skipped, errors collected", async () => {
		const t = T(new Sock(), new Boom(1), new Conn(2));
		const [_s] = t; // move the Sock out
		expect(async_drop(t)).rejects.toThrow(/boom 1/);
		expect(log).toEqual(["boom 1", "conn 2"]); // no "sock": it was moved out
	});
	test("concurrent double async_drop rejects", async () => {
		const t = T(new Sock());
		const first = async_drop(t);
		expect(async_drop(t)).rejects.toThrow(/cannot drop a dropped value/);
		await first;
	});
});

describe("Tuple: traits", () => {
	test("impls sees Drop, AsyncDrop and Container through the proxy", () => {
		const t = T();
		expect(impls(t, Drop) && impls(t, AsyncDrop) && impls(t, Container)).toBe(true);
	});
	// type-level (a separate *.test-d.ts, or // @ts-expect-error lines):
	//   drop(T(1)) compiles; drop(new Sock()) is a type error; drop of a plain class with both traits errors
});

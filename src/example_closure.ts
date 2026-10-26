export class FixedArray<T, N extends number> extends impl(Drop, Slice)<T> {
	[Symbol.dispose]() {
		// closure-scoped: no this.#dropped, no WeakMap/Map
	}

	constructor(initial_value: T, size: N) {
		let dropped = false;

		// bind the method to close over `dropped`
		(this as any)[Symbol.dispose] = () => {
			if (dropped) panic(`use of dropped value`);
			dropped = true;
			// dispose elements, reset len, etc.
		};

		super(...);
		// ... proxy setup ...
	}
}

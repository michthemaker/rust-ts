import { expect, test } from "bun:test";
import { Clone, derive_clone } from "../src/clone.ts";
import { impl } from "../src/lang/index.ts";

// const Dyn = trait([Default], (b: any) => {
//   return class Dyn extends b {};
// });
//
// const GenericDyn = <T>() =>
//   trait([Default], (b: any) => {
//     return class Dyn extends b {};
//   });
// const genericdyn_impled = impl(GenericDyn);
// const genericdyn_genericdyn_impled = impl(GenericDyn, GenericDyn);
//
// const see_clone = Clone;
//
// const clone_impled = impl(Clone);
// const clone_clone_impled = impl(Clone, Clone);
// const default_clone_impled = impl(Clone, Default);
// const default_impled = impl(Default);
// const dyn_impled = impl(Dyn);
// const dyn_dyn_impled = impl(Dyn, Dyn);
// const dyn_default_impled = impl(Dyn, Default);

test("derive clone", () => {
	class Point extends impl(Clone) {
		constructor(
			public x: number,
			public y: number
		) {
			super();
		}
		clone() {
			return derive_clone(this);
		}
	}

	const my_point = new Point(4, 5);
	expect(my_point).toBe(my_point);
	console.log(my_point.clone(), "cloned");
	expect(my_point).to_equal(my_point.clone());
});

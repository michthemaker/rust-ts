import { type AnyCons } from "../src/primitive/index.ts";

export function is_sub_class_of(child_class: AnyCons<any>, parent_class: AnyCons<any>) {
	let current = child_class;

	// Traverse up the prototype chain
	while (current !== null) {
		// If the next prototype up matches the parent class, it's a match
		if (Object.getPrototypeOf(current) === parent_class) {
			return true;
		}
		current = Object.getPrototypeOf(current);
	}

	return false;
}

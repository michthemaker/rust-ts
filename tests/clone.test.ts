import { expect, test } from "bun:test";
import { Clone, derive_clone } from "../src/clone";
import { impl } from "../src/trait";

test("derive clone", () => {
  class Point extends impl(Clone) {
    constructor(
      public x: number,
      public y: number,
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

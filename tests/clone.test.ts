import { expect, test } from "bun:test";
import { derive_clone } from "../src/clone";

test("derive clone", () => {
  class Point {
    constructor(
      public x: number,
      public y: number,
    ) {}
    clone() {
      return derive_clone(this);
    }
  }

  const my_point = new Point(4, 5);
  expect(my_point).toBe(my_point);
  console.log(my_point.clone(), "cloned");
  expect(my_point).not.toBe(my_point.clone());
});

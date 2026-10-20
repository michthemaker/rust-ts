import { expect } from "bun:test";
import { is_eq } from "../src/cmp/partial_eq.ts";

expect.extend({
  to_equal(received, expected) {
    const pass = is_eq(received, expected);
    if (pass) {
      return {
        pass: true,
        message: () => `expected ${received} not to equal ${expected} using deep equality`,
      };
    } else {
      return {
        pass: false,
        message: () => `expected ${received} to equal ${expected} using deep equality`,
      };
    }
  },
});

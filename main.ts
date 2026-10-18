import "./src/globals.ts";
import { match } from "./src/match.ts";
import { Result } from "./src/result.ts";

console.log(i8(127));
console.log(u64(127n));
console.log(usize(1e8));

console.log(f32(3.4028235e38));
console.log(d32("1000.00"));

const err = match(Result.Err(new Error("namesls")), {
  Err(err) {
    console.log(err.message, "memsla");
    return err;
  },
});

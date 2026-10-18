import "./src/globals.ts";
import { match } from "./src/match.ts";
import { Option } from "./src/option.ts";
import { Result } from "./src/result.ts";

console.log(i8(127));
console.log(u64(127n));
console.log(usize(1e8));

console.log(f32(3.4028235e38));
console.log(d32("1000.00"));

match(Result.Err(new Error("namesls")), {
  Ok(val) {
    console.log(val, "memsla");
    return val;
  },
  Err(err) {
    console.log(err.name, "I am the error", "next will throw");
  },
});

match(Option.Some(new Error("namesls")), {
  None() {
    console.log("None covered");
    return 2999;
  },
});

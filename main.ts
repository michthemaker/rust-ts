import { is_equal } from "./src/cmp/partial_eq.ts";
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

const ERR_CLOSED = new Error("Channel closed");
const ERR_CLOSED_NO_RX = new Error("Channel closed (No Receivers)");

console.log(is_equal(Result.Err(ERR_CLOSED), Result.Err(ERR_CLOSED_NO_RX)));

console.log(is_equal(Result.Ok(1), Result.Ok(3202)));
console.log(is_equal(Result.Ok(1), Result.Ok(1)));
console.log(is_equal(Option.Some(1), Option.Some(3202)));
console.log(is_equal(Option.Some(1), Option.Some(1)));

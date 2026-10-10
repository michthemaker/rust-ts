import { FixedArray } from "./src/fixed_array";
import { match, P } from "./src/match";
import { Option } from "./src/option";
import { Result } from "./src/result";

match(Option.Some(5), {
  [P.Some("sja")](v) {
    console.log(v);
  },
  Some(val) {
    console.log(val);
  },
  [P._]() {},
});

const res = Result.Err("names" as const);

match(res, {
  [P.Err("name")](v) {
    console.log(v);
  },
  [P.Err("john")](v) {
    console.log(v);
  },
  Err(e) {
    console.log(e);
  },
  [P._]() {},
});

const my_names = new FixedArray("John", 2);

my_names.len();

match(my_names, {
  [P.FixedArray(["John"])](e) {
    console.log(e);
  },
  [P._]() {},
});

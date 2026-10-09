import { match, P } from "./src/match";
import { Option } from "./src/option";
import { Result } from "./src/result";
import { FixedArray } from "./src/vec";
//
// const my_val = "None";
//
// match(my_val, {
//   None() {
//     console.log("yes");
//     return "yes";
//   },
//   Ok() {
//     return "no";
//   },
// });
//
// match(2, {
//   [P._]() {
//     console.log("exhausted it");
//   },
//   2() {},
// });
//
// const my_option = Option.Some(5);
//
// match(my_option, {
//   [P.Some(5)](v) {},
//   Some() {},
//   None() {},
// });
//
// const fixed_date = new Date();
// const option_1 = Option.Some(fixed_date);
//
// match(option_1, {
//   [P.Some(new Date(fixed_date))](date) {
//     console.log(date, "I am the same date");
//   },
//   Some() {
//     console.log("at least we are in Some");
//   },
//   None() {
//     console.log("we are in None?");
//   },
// });
//
// const my_object = { name: "John" };
//
// match(my_object, {
//   [P.Val({ name: "Logia" })](v) {
//     console.log(v);
//   },
//   [P.Val({ name: "John" })](v) {
//     console.log(v);
//   },
// });

// const my_vec = vec([9, 5]);

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

match(my_names, {
  [P.FixedArray(["John"])](e) {
    console.log(e);
  },
  [P._]() {},
});

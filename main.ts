import { match, Pattern } from "./src/match";
import { Option } from "./src/option";
import { Result } from "./src/result";
import { vec } from "./src/vec";
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
//   [Pattern._]() {
//     console.log("exhausted it");
//   },
//   2() {},
// });
//
// const my_option = Option.Some(5);
//
// match(my_option, {
//   [Pattern.Some(5)](v) {},
//   Some() {},
//   None() {},
// });
//
// const fixed_date = new Date();
// const option_1 = Option.Some(fixed_date);
//
// match(option_1, {
//   [Pattern.Some(new Date(fixed_date))](date) {
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
//   [Pattern.Val({ name: "Logia" })](v) {
//     console.log(v);
//   },
//   [Pattern.Val({ name: "John" })](v) {
//     console.log(v);
//   },
// });

// const my_vec = vec([9, 5]);

match(Option.Some(5), {
  [Pattern.Some("sja")](v) {
    console.log(v);
  },
  Some(val) {
    console.log(val);
  },
  [Pattern._]() {},
});

const res = Result.Err("names" as const);

match(res, {
  [Pattern.Err("name")](v) {
    console.log(v);
  },
  [Pattern.Err("john")](v) {
    console.log(v);
  },
  Err(e) {
    console.log(e);
  },
  [Pattern._]() {},
});

const my_numbers = vec([5, 7, 9, 2]);

match(my_numbers, {
  [Pattern.Val(9)]() {
    console.log(9);
  },
  [Pattern.Vec([5, 7, 9, 2])](arr) {
    arr;
  },
  [Pattern._]() {},
});

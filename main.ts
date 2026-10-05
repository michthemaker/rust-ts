import { match, Pattern } from "./src/match";
import { Option } from "./src/option";

const my_val = "None";

match(my_val, {
  None() {
    console.log("yes");
    return "yes";
  },
  Ok() {
    return "no";
  },
});

match(2, {
  [Pattern._]() {
    console.log("exhausted it");
  },
  2() {},
});

const my_option = Option.None();

match(my_option, {
  Some() {},
  None() {},
});

const fixed_date = new Date();
const option_1 = Option.Some(fixed_date);

match(option_1, {
  [Pattern.Some(new Date(fixed_date))](date) {
    console.log(date, "I am the same date");
  },
  Some() {
    console.log("at least we are in Some");
  },
  None() {
    console.log("we are in None?");
  },
});

const my_object = { name: "John" };

match(my_object, {
  [Pattern.Val({ name: "Logia" })](v) {
    console.log(v);
  },
  [Pattern.Val({ name: "John" })](v) {
    console.log(v);
  },
});

const my_string = "cruel";

match(my_string, {
  [Pattern.Val("cruel")](v) {
    console.log(v);
  },
  cruel() {},
});

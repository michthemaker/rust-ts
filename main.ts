import { is_equal } from "./src/cmp/partial_eq.ts";
import { FixedArray } from "./src/fixed_array.ts";
import "./src/globals.ts";
import { match } from "./src/match.ts";
import { Option } from "./src/option.ts";
import { Result } from "./src/result.ts";
import { vec } from "./src/vec.ts";

export function main() {
  console.log(i8(127));
  console.log(u64(127n));
  console.log(usize(1e8));

  console.log(f32(3.4028235e38));
  console.log(d32("1000.00").eq(29));

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

  console.log(is_equal(Result.Err(ERR_CLOSED), Result.Err(ERR_CLOSED_NO_RX)), "the error one");

  console.log(is_equal(Result.Ok(1), Result.Ok(3202)));
  console.log(is_equal(Result.Ok(1), Result.Ok(1)));
  console.log(is_equal(Option.Some(1), Option.Some(3202)));
  console.log(is_equal(Option.Some(1), Option.Some(1)));

  console.log(Option.Some(93920).ok_or("slels"));
  console.log(Result.Ok(39202).ok());
  console.log(Result.Ok(39202).err());
  console.log(Result.Err(39202).ok());
  console.log(Result.Err(39202).err());

  console.log("-------");
  console.log(d32("2929.00").eq(d32("0.299")));
  console.log(d32("2929.00").eq(d32("2929.00")));
}

console.log(is_equal(vec([0, 0, 0, 0]), new FixedArray(29, 4)));

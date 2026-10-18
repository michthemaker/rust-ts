import "./src/globals.ts";
import { Result } from "./src/result.ts";
import { Tuple } from "./src/tuple.ts";
// console.log(i8(127));
// console.log(u64(127n));
// console.log(usize(1e8));
//
// console.log(f32(3.4028235e38));
// console.log(d32("1000.00"));
//

const [num, ...rest] = Tuple("920", Result.Err(2929));
console.log(num, ...rest);
console.log(Tuple("920", Result.Err(2929), d32("0.20202")));

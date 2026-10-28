// import { macro, sync_mpsc, lang, Vec } from "./src/prelude.ts";
//
// const { println, format } = macro;
// const { Tuple, match, P } = lang;
// const { channel } = sync_mpsc;
//
// const [tx, _rx] = channel<number>();
//
// println("{:?}, {:?}", tx, Tuple(0n));
// const mine = format("{:?}, {:?}", tx, Tuple(0n));
// console.log(mine, format("working"));
//
// match(Vec.new(), {
// 	[P.Vec([0])]() {},
// 	[P._]() {}

import { FixedArray } from "./src/array.ts";

// });
const value = {};
const arr = FixedArray(value, 1);

console.log(value === arr.last().unwrap(), arr.len());

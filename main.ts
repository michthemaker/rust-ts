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
import { AsyncDrop, Drop } from "./src/ops.ts";
import { impl } from "./src/trait_impl.ts";
import { Vec, vec } from "./src/vec.ts";

class MyClass extends impl(AsyncDrop, Drop) {
	async [Symbol.asyncDispose]() {}
	[Symbol.dispose]() {}
}

// this should show never actually
vec<MyClass>();
vec<Vec<number>>();

const value = {};
const arr = FixedArray(value, 1);

console.log(value === arr.last().unwrap(), arr.len());

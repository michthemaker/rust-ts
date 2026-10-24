import "./src/globals.ts";
import { format, println } from "./src/macro/index.ts";
import { channel } from "./src/sync/mpmc.ts";
import { match, P, Tuple } from "./src/lang/index.ts";
import { Vec } from "./src/vec.ts";

const [tx, _rx] = channel<number>();

println("{:?}, {:?}", tx, Tuple(0n));
const mine = format("{:?}, {:?}", tx, Tuple(0n));
console.log(mine, format("working"));

match(Vec.new(), {
	[P.Vec([0])]() {},
	[P._]() {}
});

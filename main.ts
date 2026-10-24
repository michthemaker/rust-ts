import "./src/globals.ts";
import { println } from "./src/println.ts";
import { channel } from "./src/sync/mpmc.ts";
import { match, P, Tuple } from "./src/primitive/index.ts";
import { Vec } from "./src/vec.ts";

const [tx, _rx] = channel<number>();

println("{:?}, {:?}", tx, Tuple(0n));

match(Vec.new(), {
	[P.Vec([0])]() {}
});

import "./src/globals.ts";
import { println } from "./src/println.ts";
import { channel } from "./src/sync/mpmc_channel.ts";
import { Tuple } from "./src/tuple.ts";

const [tx, _rx] = channel<number>();

println("{:?}, {:?}", tx, Tuple(0n));

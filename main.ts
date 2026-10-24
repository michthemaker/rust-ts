import { Default } from "./src/default.ts";
import "./src/globals.ts";
import { Option } from "./src/option.ts";
import { println } from "./src/println.ts";
import { channel } from "./src/sync/mpmc_channel.ts";
import { Tuple } from "./src/tuple.ts";

const [tx, rx] = channel<number>();

println("{:?}, {:?}", tx, Tuple(0n));

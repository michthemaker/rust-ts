import { Clone } from "./src/clone.ts";
import { is_eq, PartialEq } from "./src/cmp.ts";
import { Default } from "./src/default.ts";
import { FixedArray } from "./src/fixed_array.ts";
import { Debug } from "./src/fmt.ts";
import "./src/globals.ts";
import { match } from "./src/match.ts";
import { Option } from "./src/option.ts";
import { println } from "./src/println.ts";
import { range } from "./src/range.ts";
import { Result } from "./src/result.ts";
import { OnceLock } from "./src/sync/once_lock.ts";
import { impls } from "./src/trait.ts";
import { Tuple } from "./src/tuple.ts";
import { vec, Vec } from "./src/vec.ts";

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
		}
	});

	const ERR_CLOSED = new Error("Channel closed");
	const ERR_CLOSED_NO_RX = new Error("Channel closed (No Receivers)");

	console.log(is_eq(Result.Err(ERR_CLOSED), Result.Err(ERR_CLOSED_NO_RX)), "the error one");

	console.log(is_eq(Result.Ok(1), Result.Ok(3202)));
	console.log(is_eq(Result.Ok(1), Result.Ok(1)));
	console.log(is_eq(Option.Some(1), Option.Some(3202)));
	console.log(is_eq(Option.Some(1), Option.Some(1)));

	console.log(Option.Some(93920).ok_or("slels"));
	console.log(Result.Ok(39202).ok());
	console.log(Result.Ok(39202).err());
	console.log(Result.Err(39202).ok());
	console.log(Result.Err(39202).err());

	console.log("-------");
	console.log(d32("2929.00").eq(d32("0.299")));
	console.log(is_eq(vec([0, 0, 0, 0]), new FixedArray(29, 4)));
	console.log(is_eq(new FixedArray(29, 4), new FixedArray(29, 4)));

	console.log(is_eq(Result.Err("sl"), Result.Err("sl")));
	console.log(is_eq(Option.None(), Option.None()));

	console.log(vec([0, 29, 290]));
	const value = new OnceLock<number>();
	value.set(902);
	const cloned = value.clone();
	match(cloned.set(999), {
		Ok() {
			console.log("we hit this");
		},
		Err() {}
	});
	console.log(is_eq(value, cloned));

	const dec = d32("0.2");
	console.log(dec.clone().eq(dec));
	new FixedArray(0, 5).clone();

	const big = vec([19, 29, 39, 20, 10, 20]).get(range(2, 6)).unwrap();

	console.log(big.clone());

	console.log(impls(vec(), PartialEq));
	console.log(impls(vec(), Debug));
	console.log(impls(vec(), Clone));
	console.log(vec([0, 290, 0o7272]).clone());
	console.log(is_eq(Result.Ok(d32("0")), Result.Err(d32("0"))));
	console.log(is_eq(Option.Some(d32("0")), Option.Some(d32("0"))));

	console.log(vec<number>().eq(new FixedArray(0, 0).clone().get(range(0, 0)).unwrap()), "je");

	console.log(is_eq(vec([0, 2]).get(range(0, 1)).unwrap(), vec([0])));

	console.log(is_eq(Tuple(0, d32("92")), Tuple()));

	const mine_3 = OnceLock.default<d32>();

	console.log(mine_3);

	const mine_4 = Default.default(OnceLock<number>);

	// @ts-expect-error
	println("name {:?}", d32("0.2"));

	console.log(Option.Some("29").clone());
	console.log(mine_4);
}

main();
const more = new Vec<number>();
console.log(more.clone());
const mine = Default.default(Vec<string>);
Default.default(OnceLock<string>);
Vec.default<string>();

// console.log(FixedArray(0, 8)[8]);

mine.push("900");
mine.push("0000");

mine.push("0000");
mine.push("0000");
mine.push("0000");
println("working x2 {} ", 3);
println("{:?}", "nameing");
println("working x2 {:?} ", 1000_000_0000_0000_0000_0000_0000_0000n);

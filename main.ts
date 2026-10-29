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
//
// import { FixedArray } from "./src/array.ts";
// import { Default } from "./src/default.ts";
import { AsyncDrop, Container, Drop } from "./src/ops.ts";
// import { Option } from "./src/option.ts";
// import { OnceLock } from "./src/sync/once_lock.ts";
import { impl } from "./src/trait_impl.ts";
// import { Vec, vec } from "./src/vec.ts";
//
// class MyClass extends impl(AsyncDrop) {
// 	async [Symbol.asyncDispose]() {}
// }
// export class MyClass2 extends impl(Drop) {
// 	[Symbol.dispose]() {}
// }

//
// Default.default(Vec<MyClass3>);
//
// // this should show never actually
// vec<string>();
// vec([0]);
// vec([Option.Some(new MyClass()), Option.Some(new MyClass())]);
// vec(new MyClass3(), 3);
//
// Vec.with_capacity(0);
// Vec.from_elem(new MyClass3(), 9);
// Vec.default();
// Vec.from_iter([new MyClass3()]);
//
// vec();
// FixedArray(vec(), 9 as any);
//
// export class MyClass3 extends impl(Drop, AsyncDrop, Container) {
// 	[Symbol.dispose]() {
// 		console.log("now works");
// 	}
// 	async [Symbol.asyncDispose]() {
// 		console.log("checked");
// 	}
// }
// export class MyClass4 extends impl(Drop, AsyncDrop) {
// 	[Symbol.dispose]() {}
// 	async [Symbol.asyncDispose]() {}
// }
// const value = {};
// working.get_or_init(() => new MyClass4)
// const arr = FixedArray.from_fn(3, () => new MyClass());
//
// console.log(value === arr.last().unwrap(), arr.len());

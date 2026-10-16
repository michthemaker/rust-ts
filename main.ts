import "./src/globals.ts";
console.log(i8(127));
console.log(u64(127n));
console.log(usize(1e8));

console.log(f32(3.4028235e38));
console.log(d32("1000.00"));

const one = d128("6.0");
const two = d128("2.0");

const _3 = one.add(two);
const _4 = one.sub(two);
const _5 = one.mul(two);
const _6 = one.div(two);
console.log(_6.eq(d128("3.000")));

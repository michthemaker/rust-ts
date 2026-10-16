import "./src/globals.ts";
console.log(i8(127));
console.log(u64(127n));
console.log(usize(10300));

console.log(f32(3.4028235e38));
console.log(d32("1000.00"));
console.log(d128("10000.1234").add(d128("0.1")));

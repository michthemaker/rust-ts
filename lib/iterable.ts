export function is_iterable(value: any): value is Iterable<any, any, any>;
export function is_iterable(value: any): value is AsyncIterable<any, any, any>;
export function is_iterable(value: any) {
	return (
		typeof (value as Iterable<any, any, any>)[Symbol.iterator] === "function" ||
		typeof (value as AsyncIterable<any, any, any>)[Symbol.asyncIterator] === "function"
	);
}

export function is_thenable(v: unknown): v is PromiseLike<unknown> {
	if ((typeof v !== "object" || v === null) && typeof v !== "function") return false;
	return typeof (v as { then?: unknown }).then === "function";
}

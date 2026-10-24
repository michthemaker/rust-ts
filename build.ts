// scripts/gen-exports.ts
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const INTERNAL: RegExp[] = [/_impl\.ts$/, /\.d\.ts$/];

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else if (entry.endsWith(".ts") && !INTERNAL.some((re) => re.test(entry))) out.push(full);
	}
	return out;
}

const exportsMap: Record<string, string> = { ".": "./src/prelude.ts" };
const preludeLines: string[] = [];

for (const file of walk("src")) {
	const normalizedFile = file.replace(/\\/g, "/");
	if (normalizedFile === "src/prelude.ts") continue;

	// package.json logic remains unchanged
	let rel = relative("src", file).replace(/\.ts$/, "").replace(/\\/g, "/");
	if (rel.endsWith("/index")) rel = rel.slice(0, -6);
	exportsMap[`./${rel}`] = `./${normalizedFile}`;

	// Prelude logic: Check if it's in a subdirectory
	const relativeToPrelude = relative("src", file).replace(/\\/g, "/");
	const parts = relativeToPrelude.split("/");

	if (parts.length > 1) {
		// e.g., "sync/mpmc.ts" -> export * as sync_mpmc from "./sync/mpmc.ts";
		const namespaceAlias = parts.map((p) => p.replace(/\.ts$/, "")).join("_");
		preludeLines.push(
			`export * as ${namespaceAlias.replaceAll("_index", "")} from "./${relativeToPrelude}";`
		);
	} else {
		// Root-level src files remain flat
		preludeLines.push(`export * from "./${relativeToPrelude}";`);
	}
}

await Bun.write("src/prelude.ts", preludeLines.join("\n") + "\n");

const pkgFile = Bun.file("package.json");
const pkg = await pkgFile.json();
pkg.exports = exportsMap;
await Bun.write("package.json", JSON.stringify(pkg, null, 2) + "\n");

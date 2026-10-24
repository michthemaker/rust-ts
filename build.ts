import { Glob } from "bun";

// 1. Scan the src directory for all TypeScript files
const glob = new Glob("**/*.ts");
const entrypoints = Array.from(glob.scanSync({ cwd: "./src" })).map((file) => `./src/${file}`);

console.log();

// 2. Pass the list of entrypoints to Bun's bundler
await Bun.build({
	entrypoints: entrypoints,
	outdir: "./dist",
	target: "node", // Change to "browser" if this is frontend code,
	splitting: true
});

console.log(`Successfully built ${entrypoints.length} modules!`);

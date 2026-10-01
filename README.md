# rust-ts

A small TypeScript port of some of Rust's most useful patterns and ergonomics.

This project brings over ideas like `Option`, `Result`, `OnceLock`, thread helpers, and channel-based message passing so TypeScript code can feel a bit more like idiomatic Rust without needing to write Rust itself.

Highlights:
- `Option` and `Result` types for safer value and error handling
- `OnceLock` for one-time initialization
- `mpsc` / `spsc` channel primitives for async and sync communication
- lightweight threading helpers
- protocol and shell utilities inspired by Rust-style composition

Install:

```bash
bun install
```

Run the demo:

```bash
bun run main.ts
```

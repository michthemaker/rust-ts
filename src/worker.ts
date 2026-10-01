import "./protocol.ts"; // Registers TRANSFER_SYMBOL
import "./result.ts"; // Registers Result type
import "./option.ts"; // Just utilities, no hydration needed
import "./mpsc_channel.ts"; // Registers Sender/Receiver hydrators
import "./threads.ts"; // Registers spawn/move hydrators
import { type BunMessageEvent } from "bun";
import { HIDDEN_RESULT_TAG } from "./result.ts";
import { patch_dynamic_imports } from "../lib/patch_dynamic_import.ts";
import { get_caller_location } from "../lib/get_caller_location.ts";

// Now globalThis.__INTERNAL_RUST_THREAD_HYDRATORS__ has all the hydrators

globalThis.addEventListener(
  "message",
  async (
    event: BunMessageEvent<{
      __INTERNAL_RUST_THREAD_PAYLOAD_BRAND__: true;
      fn: string;
      args: any[];
    }>,
  ) => {
    const data = event.data;

    if (!data.__INTERNAL_RUST_THREAD_PAYLOAD_BRAND__) return;
    try {
      const rawArgs = data.args || [];
      const runtimeArgs = rawArgs.map((arg) => {
        // If it matches our custom envelope schema, rehydrate it on the fly!
        if (arg && typeof arg === "object" && arg.__is_envelope === true) {
          const hydrator = globalThis.__INTERNAL_RUST_THREAD_HYDRATORS__.get(arg.brand);
          if (!hydrator) {
            throw new Error("Missing hydration handler inside worker for brand: " + arg.brand);
          }
          return hydrator(arg.data);
        }
        return arg;
      });
      const code = patch_dynamic_imports(
        "export default " + data.fn,
        get_caller_location().filePath,
      );
      const base64Code = btoa(code);
      const dataUrl = `data:text/javascript;base64,${base64Code}`;
      const mod = await import(dataUrl);
      const func = mod.default as Function;
      const result = await (async () => {
        return func(...runtimeArgs);
      })();

      // this makes it a result type
      postMessage({ ok: true, value: result, [HIDDEN_RESULT_TAG]: true });
    } catch (panicError) {
      // pass something that looks like a Result::Err
      postMessage({ ok: false, error: panicError, [HIDDEN_RESULT_TAG]: true });
    }
  },
  { once: true },
);

import "../result.ts"; // Registers Result type
import "../option.ts"; // Just utilities, no hydration needed
import "../sync/mpsc_channel.ts"; // Registers Sender/Receiver hydrators
import "../sync/mpmc_channel.ts"; // Registers Sender/Receiver hydrators
import "./threads.ts"; // Registers spawn/move hydrators
import { type BunMessageEvent } from "bun";
import { HIDDEN_RESULT_TAG } from "../result.ts";
import { patch_dynamic_imports } from "../../lib/patch_dynamic_import.ts";
import { get_caller_location } from "../../lib/get_caller_location.ts";
import { type WorkerPayload } from "./types";
import { deserialize } from "./serializable.ts";

globalThis.addEventListener(
  "message",
  async (event: BunMessageEvent<WorkerPayload>) => {
    const { raw_args, fn: func_string, ...data } = event.data;

    const activeArgs = new Array(raw_args.length);

    if (!data.__INTERNAL_RUST_THREAD_PAYLOAD_BRAND__) return;
    try {
      for (let i = 0; i < raw_args.length; i++) {
        activeArgs[i] = deserialize(raw_args[i]!);
      }
      const code = patch_dynamic_imports(
        "export default " + func_string,
        get_caller_location().filePath,
      );
      const base_64_code = btoa(code);
      const data_url = `data:text/javascript;base64,${base_64_code}`;
      const mod = await import(data_url);
      const func = mod.default as Function;
      const result = await (async () => {
        return func(...activeArgs);
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

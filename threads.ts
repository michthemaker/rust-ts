import { BunMessageEvent } from "bun";
import { Result as Core_Result, HIDDEN_RESULT_TAG } from "./result";
import { SerializableThreadAsset, ThreadEnvelope, TRANSFER_SYMBOL } from "./protocol";

type Result<T> = Core_Result<T, unknown>;

class JoinHandle<T> {
  private worker: Worker;
  private join_promise: Promise<Result<T>>;

  constructor(worker_code: string) {
    const blob = new Blob([worker_code], { type: "text/javascript" });
    const worker_url = URL.createObjectURL(blob);
    this.worker = new Worker(new URL(worker_url));

    this.join_promise = new Promise((res) => {
      this.worker.addEventListener(
        "message",
        (event: BunMessageEvent<T>) => {
          let rawValue = event.data;
          this.worker.terminate();
          URL.revokeObjectURL(worker_url);
          if (rawValue && Core_Result.is_result(rawValue))
            res(Core_Result.from(rawValue) as unknown as Result<T>);
          else res(Core_Result.Ok(rawValue));
        },
        { once: true },
      );

      this.worker.addEventListener(
        "error",
        (err) => {
          this.worker.terminate();
          URL.revokeObjectURL(worker_url);
          res(Core_Result.Err(err));
        },
        { once: true },
      );

      this.worker.addEventListener(
        "close",
        (event: any) => {
          const code = event.code ?? 0;
          URL.revokeObjectURL(worker_url);
          this.worker.terminate();
          if (code !== 0) {
            res(Core_Result.Err(new Error(`Thread stopped with exit code ${code}`)));
          }
        },
        { once: true },
      );
    });
  }

  async join() {
    return this.join_promise;
  }
}

class MoveToken {
  constructor(public args: any[]) {}
}

function move(...args: any[]): MoveToken {
  return new MoveToken(args);
}

globalThis.addEventListener("message", (event) => {
  event.p;
});

interface Threads {
  spawn<U, T = Awaited<U>>(f: () => U): JoinHandle<T>;
  spawn<Args extends any[], U, T = Awaited<U>>(
    token: MoveToken,
    f: (...args: Args) => U,
  ): JoinHandle<T>;
}

/**
 * ```javascript
 * 	self.onmessage = async (event) => {
   try {
     const rawArgs = event.data.args || [];
     const ports = event.ports || [];
     let portIndex = 0;

     const runtimeArgs = rawArgs.map((arg) => {
       // If it matches our custom envelope schema, rehydrate it on the fly!
       if (arg && typeof arg === "object" && arg.__is_envelope === true) {
         const hydrator = globalThis.__THREAD_HYDRATORS__.get(arg.brand);
         if (!hydrator) {
           throw new Error("Missing hydration handler inside worker for brand: " + arg.brand);
         }
         const activePort = ports[portIndex++];
         return hydrator(arg.data, activePort);
       }
       return arg;
     });

     const result = await (async () => {
       return (${f.toString()})(...runtimeArgs);
     })();

     postMessage({ ok: true, value: result });
   } catch (panicError) {
     postMessage({ ok: false, error: panicError });
   }
 };

 * ```
 */
const threads: Threads = {
  // they can pass a sync or async function we will get the value and send to them after unwrapping it.
  spawn(arg1, arg2) {
    let fn: Function;
    let serialized_args_payload: any[] = [];

    if (arg1 instanceof MoveToken) {
      fn = arg2;
      for (const argument of arg1.args) {
        if (SerializableThreadAsset.is_serializable(argument)) {
          const extraction = argument[TRANSFER_SYMBOL]();

          const envelope: ThreadEnvelope = {
            __is_envelope: true,
            ...extraction,
          };
          serialized_args_payload.push(envelope);
        } else serialized_args_payload.push(argument);
      }
    } else fn = arg1;

    const code = `
    (async () => {
      try {
        const result = await (async () => {
        	return (${f.toString()})()
        })();
        if (typeof parentPort !== "undefined") {
          parentPort.postMessage(result);
        } else if (typeof postMessage !== "undefined") {
          postMessage(result);
        }
      } catch (panicError) {
        const errorPayload = { ok: false, error: panicError, ${HIDDEN_RESULT_TAG}: true };
        if (typeof parentPort !== "undefined") {
          parentPort.postMessage(errorPayload);
        } else if (typeof postMessage !== "undefined") {
          postMessage(errorPayload);
        }
      }
    })()
    `;

    return new JoinHandle(code);
  },
};

export { threads, move };

// The background worker uses the global registry to reconstruct incoming payloads

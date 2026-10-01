import { BunMessageEvent } from "bun";
import { Result as Core_Result, HIDDEN_RESULT_TAG } from "./result";
import { SerializableThreadAsset, ThreadEnvelope, TRANSFER_SYMBOL } from "./protocol";

type Result<T> = Core_Result<T, unknown>;

type JoinHandleOptions = {
  on_create?: (worker: Worker) => void;
};

class JoinHandle<T> {
  private worker: Worker;
  private join_promise: Promise<Result<T>>;

  constructor(worker_code: string, options?: JoinHandleOptions) {
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

    // handle options here
    if (options?.on_create) {
      options.on_create(this.worker);
    }
  }

  async join() {
    return this.join_promise;
  }

  async get_worker() {
    return this.worker;
  }
}

class MoveToken<T extends any[] = any[]> {
  constructor(public args: T) {}
}

declare global {
  var move: <T extends any[]>(...args: T) => MoveToken<T>;
}

globalThis.move =
  globalThis.move ||
  function move<T extends any[]>(...args: T): MoveToken<T> {
    return new MoveToken(args);
  };

interface Threads {
  spawn<U, T = Awaited<U>>(f: () => U): JoinHandle<T>;
  spawn<Args extends any[], U, T = Awaited<U>>(
    token: MoveToken<Args>,
    f: (...args: Args) => U,
  ): JoinHandle<T>;
}

const threads: Threads = {
  // they can pass a sync or async function we will get the value and send to them after unwrapping it.
  spawn(arg1: MoveToken | Function, arg2?: Function) {
    let fn: Function;
    let serialized_args_payload: any[] = [];

    if (arg1 instanceof MoveToken) {
      fn = arg2!;
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

    const code = `self.onmessage = async (event) => {
  try {
    const rawArgs = event.data.args || [];

        console.log(rawArgs)
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

    const result = await (async () => {
      return (${fn.toString()})(...runtimeArgs);
    })();

    // this makes it a result type
    postMessage({ ok: true, value: result, ${HIDDEN_RESULT_TAG}: true });
  } catch (panicError) {
    postMessage({ ok: false, error: panicError, ${HIDDEN_RESULT_TAG}: true });
  }
};`;

    const handle = new JoinHandle(code, {
      on_create: (worker) => {
        worker.postMessage({ args: serialized_args_payload });
      },
    });

    return handle;
  },
};

export { threads };

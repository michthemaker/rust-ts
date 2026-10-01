import { BunMessageEvent } from "bun";
import { Result as Core_Result } from "./result";
import { SerializableThreadAsset, ThreadEnvelope, TRANSFER_SYMBOL } from "./protocol";

type Result<T> = Core_Result<T, unknown>;

class JoinHandle<T> {
  private worker: Worker;
  private join_promise: Promise<Result<T>>;

  constructor(fn: Function, serialized_payload: any[]) {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    // we may not need this promise again
    this.join_promise = new Promise((res) => {
      this.worker.addEventListener(
        "message",
        (event: BunMessageEvent<T>) => {
          let rawValue = event.data;
          this.worker.terminate();
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
          res(Core_Result.Err(err));
        },
        { once: true },
      );

      this.worker.addEventListener(
        "close",
        (event: any) => {
          const code = event.code ?? 0;
          this.worker.terminate();
          if (code !== 0) {
            res(Core_Result.Err(new Error(`Thread stopped with exit code ${code}`)));
          }
        },
        { once: true },
      );
    });

    this.worker.postMessage({
      __INTERNAL_RUST_THREAD_PAYLOAD_BRAND__: true,
      fn: fn.toString(),
      args: serialized_payload,
    });
  }

  async join() {
    return this.join_promise;
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

    const handle = new JoinHandle(fn, serialized_args_payload);

    return handle;
  },
};

export { threads };

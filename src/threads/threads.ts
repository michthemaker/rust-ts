import { BunMessageEvent } from "bun";
import { Result as Core_Result } from "../result";
import { WorkerPayload } from "./types";
import { serialize } from "./serializable";
import { Transferable } from "./transferable";
import { get_caller_location } from "../../lib/get_caller_location";

type Result<T> = Core_Result<T, unknown>;

type UnserializedArgs = { __unserialized: true }[];

const EMPTY_ARRAY: any[] = [];

class JoinHandle<T> {
  private worker: Worker;
  private join_promise: Promise<Result<T>>;

  constructor(fn: Function, raw_args: UnserializedArgs, caller: string) {
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

    const [serialized_args, transfer_list] = this.process_args(raw_args);

    this.worker.postMessage(
      {
        __INTERNAL_RUST_THREAD_PAYLOAD_BRAND__: true,
        fn: fn.toString(),
        caller,
        raw_args: serialized_args,
      } as WorkerPayload,
      transfer_list,
    );
  }

  async join() {
    return this.join_promise;
  }

  private process_args(args: UnserializedArgs): [any[], Transferable[]] {
    const len = args.length;
    if (len === 0) return [EMPTY_ARRAY, EMPTY_ARRAY];

    const values = new Array(len);
    const transfers: Transferable[] = [];

    for (let i = 0; i < len; i++) {
      const serialized = serialize(args[i]);
      values[i] = serialized[0];

      const transfer_list = serialized[1];
      if (transfer_list && transfer_list.length > 0) {
        const tLen = transfer_list.length;
        for (let j = 0; j < tLen; j++) {
          transfers.push(transfer_list[j]!);
        }
      }
    }
    return [values, transfers];
  }
}

/**
 * A branded type that ensures the array has been explicitly marked
 * by the move() function.
 */
const moveTag = Symbol("Thread.move");
export type MovedData<T extends any[]> = T & { readonly [moveTag]: true };

export function move<Args extends any[]>(...args: Args): MovedData<Args> {
  return Object.defineProperty(args, moveTag, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: true,
  }) as MovedData<Args>;
}

export function drop<T extends Disposable>(resource: T) {
  resource[Symbol.dispose]();
}

declare global {
  var move: <Args extends any[]>(...args: Args) => MovedData<Args>;
}

globalThis.move = globalThis.move || move;

interface Threads {
  /**
   * Overload 1: With Move Data
   */
  spawn<Args extends any[], T>(
    payload: MovedData<Args>,
    fn: (this: void, ...args: Args) => T | Promise<T>,
  ): JoinHandle<T>;
  /**
   * Overload 2: Raw Function (No Args)
   */
  spawn<T>(fn: (this: void) => T | Promise<T>): JoinHandle<T>;
}

const threads: Threads = {
  // they can pass a sync or async function we will get the value and send to them after unwrapping it.
  spawn(arg1: any, arg2?: any) {
    // Captured on the main thread: the worker's own stack points at worker.ts.
    const caller = get_caller_location(threads.spawn).filePath;
    let fn: Function;
    let args: any[] = [];

    // Argument parsing
    if (arg1 && Object.prototype.hasOwnProperty.call(arg1, moveTag)) {
      args = arg1;
      fn = arg2;
    } else {
      fn = arg1;
    }

    const handle = new JoinHandle(fn, args, caller);

    return handle;
  },
};

export { threads };

import { SerializableId } from "./serializable";

export type SharedMemoryView =
  | Int8Array<SharedArrayBuffer>
  | Uint8Array<SharedArrayBuffer>
  | Uint8ClampedArray<SharedArrayBuffer>
  | Int16Array<SharedArrayBuffer>
  | Uint16Array<SharedArrayBuffer>
  | Int32Array<SharedArrayBuffer>
  | Uint32Array<SharedArrayBuffer>
  | Float32Array<SharedArrayBuffer>
  | Float64Array<SharedArrayBuffer>
  | BigInt64Array<SharedArrayBuffer>
  | BigUint64Array<SharedArrayBuffer>
  | DataView<SharedArrayBuffer>
  | SharedJsonBuffer<any>;

/**
 * The wire format.
 * [type, value, serializable_id (optional, only for LIB or anything that implements Serializable)]
 */
export type Envelope =
  | readonly [PayloadType.RAW, any]
  | readonly [PayloadType.LIB, any, SerializableId];

export type WorkerPayload = {
  __INTERNAL_RUST_THREAD_PAYLOAD_BRAND__: true;
  fn: string;
  /** File that called `threads.spawn`; relative `import()` paths resolve against it. */
  caller: string;
  raw_args: any[];
};

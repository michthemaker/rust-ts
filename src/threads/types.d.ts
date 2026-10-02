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
 * [type, value, typeId (optional, only for LIB)]
 */
export type Envelope = readonly [PayloadType.RAW, any] | readonly [PayloadType.LIB, any, number];

export type WorkerPayload = {
  __INTERNAL_RUST_THREAD_PAYLOAD_BRAND__: true;
  fn: string;
  raw_args: any[];
};

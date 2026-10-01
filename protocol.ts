export const TRANSFER_SYMBOL = Symbol.for("threads.transfer");

export interface ThreadEnvelope {
  readonly __is_envelope: true;
  readonly brand: string;
  readonly data: any;
}

export interface SerializableThreadAsset<T> {
  [TRANSFER_SYMBOL](): {
    data: T;
    brand: `__INTERNAL_RUST_${string}_BRAND_80x90__`;
  };
}

export class SerializableThreadAsset<T> {
  static is_serializable(obj: any): obj is SerializableThreadAsset<T> {
    return obj && typeof obj === "object" && TRANSFER_SYMBOL in obj;
  }
}

export function register_hydrator<T>(brand: string, hydrator: (data: T) => any) {
  globalThis.__INTERNAL_RUST_THREAD_HYDRATORS__.set(brand, hydrator);
}

// A global registry available in both the main thread and worker threads
declare global {
  var __INTERNAL_RUST_THREAD_HYDRATORS__: Map<string, (data: any) => any>;
}

globalThis.__INTERNAL_RUST_THREAD_HYDRATORS__ =
  globalThis.__INTERNAL_RUST_THREAD_HYDRATORS__ || new Map();

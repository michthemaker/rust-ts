import { Transferable } from "./transferable.ts";
import type { Envelope } from "./types";

export const to_serialized = Symbol("Thread.Serialize");
export const to_deserialized = Symbol("Thread.Deserialize");

export const enum PayloadType {
  RAW = 0, // User data (Numbers, Strings, Plain Objects)
  LIB = 1, // Library data (Mutex, Sender, Receiver)
}

export interface SerializableConstructor<T extends Serializable = Serializable> {
  new (...args: any[]): T;
  [to_deserialized](obj: unknown): T;
}

export abstract class Serializable {
  abstract [to_serialized]():
    | readonly [
        /**
         * value
         */
        unknown,
      ]
    | readonly [
        /**
         * value
         */
        unknown,
        /**
         * transfer
         */
        Transferable[],
      ]
    | readonly [
        /**
         * value
         */
        unknown,
        /**
         * transfer
         */
        Transferable[],
        /**
         * typeId (Escape hatch for proxies)
         */
        number,
      ];
  static [to_deserialized](_obj: unknown): Serializable {
    throw new Error(`[to_deserialized] not implemented for ${this.name}`);
  }
}

const class_registry = new Map<number, SerializableConstructor>();
const reverse_class_registry = new Map<SerializableConstructor, number>();

export function register(typeId: number, cls: SerializableConstructor) {
  class_registry.set(typeId, cls);
  reverse_class_registry.set(cls, typeId);
}

export function serialize(arg: any): [Envelope, Transferable[]] {
  // Null/Undefined
  if (arg === null || arg === undefined) {
    return [[PayloadType.RAW, arg], []];
  }

  // Library Object (Instance of Serializable)
  if (typeof arg === "object" && arg !== null && typeof arg[to_serialized] === "function") {
    const [value, transfer, typeId] = arg[to_serialized]() as ReturnType<
      Serializable[typeof to_serialized]
    >;
    const Ctor = arg.constructor as SerializableConstructor;

    return [[PayloadType.LIB, value, typeId ?? reverse_class_registry.get(Ctor)!], transfer ?? []];
  }

  // Transferables / Raw Data
  const transfer: Transferable[] = [];
  if (arg instanceof SharedArrayBuffer) {
    // No-op
  } else if (ArrayBuffer.isView(arg)) {
    if (!(arg.buffer instanceof SharedArrayBuffer)) {
      transfer.push(arg.buffer);
    }
  } else if (arg instanceof Transferable) {
    transfer.push(arg);
  }

  return [[PayloadType.RAW, arg], transfer] as const;
}

export function deserialize(envelope: Envelope): any {
  if (!envelope || typeof envelope !== "object") return envelope;

  if (envelope[0] === PayloadType.RAW) {
    return envelope[1];
  }

  if (envelope[0] === PayloadType.LIB) {
    // @ts-expect-error
    const Cls = class_registry.get(envelope[2]);
    if (Cls) {
      return Cls[to_deserialized](envelope[1]);
    }
    throw new Error(`Unknown TypeID ${envelope[2]}. Did you forget to import the class?`);
  }

  return envelope;
}

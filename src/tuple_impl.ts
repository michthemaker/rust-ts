import { Debug, FMT, FmtOptions } from "./fmt";
import { impl } from "./trait";

const INDEX = /^(0|[1-9]\d*)$/;

function panic(msg: string): never {
  throw new Error(msg);
}
export class Tuple extends impl(Debug) {
  #buf: any[];
  [FMT](
    _depth: number,
    options: FmtOptions,
    inspect: (arg: any, options: FmtOptions) => string,
  ): string {
    const items = this.#buf.map((item) => inspect(item, options));
    return `(${items.join(", ")})`;
  }
  *[Symbol.iterator](): IterableIterator<any> {
    for (let i = 0; i < this.#buf.length; i++) {
      yield this.#buf[i];
    }
  }

  constructor(args: any[]) {
    super();
    this.#buf = args;
    const buffer = this.#buf;
    Object.freeze(this);

    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === "string" && INDEX.test(prop)) {
          const index = Number(prop);
          if (index >= buffer.length)
            panic(`index out of bounds: the len is ${buffer.length} but the index is ${index}`);
          return buffer[index];
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? (value as Function).bind(target) : value;
      },
      set(_target, prop, _value) {
        // Instead of silently failing (returning false),
        // Rust-like behavior would throw a hard error on mutation
        throw new TypeError(`Cannot assign to read-only property '${String(prop)}' of Tuple`);
      },
    });
  }
}

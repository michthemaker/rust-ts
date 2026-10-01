import { register_hydrator, SerializableThreadAsset, TRANSFER_SYMBOL } from "./protocol";
import { Result } from "./result";

const LOCAL_CHANNEL_REGISTRY = new Map<number, Channel<any>>();

function register_channel_for_sharing(channel_instance: Channel<any>) {
  const channel_id = LOCAL_CHANNEL_REGISTRY.size + 1;
  LOCAL_CHANNEL_REGISTRY.set(channel_id, channel_instance);

  // Write the Channel ID into a shared 4-byte buffer
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  view[0] = channel_id;

  return sab;
}

const __INTERNAL_RUST_MPSC_CHANNEL_SENDER_BRAND_80x90__ = `__INTERNAL_RUST_MPSC_CHANNEL_SENDER_BRAND_80x90__`;
const __INTERNAL_RUST_MPSC_CHANNEL_RECEIVER_BRAND_80x90__ = `__INTERNAL_RUST_MPSC_CHANNEL_RECEIVER_BRAND_80x90__`;

/**
 * implement closing here too.
 */
class Sender<T> implements SerializableThreadAsset<SharedArrayBuffer>, Disposable {
  static {
    register_hydrator(
      __INTERNAL_RUST_MPSC_CHANNEL_SENDER_BRAND_80x90__,
      (buffer: SharedArrayBuffer) => {
        const view = new Int32Array(buffer);
        const channel_id = view[0];
        const channel_instance = LOCAL_CHANNEL_REGISTRY.get(channel_id);
        if (!channel_instance) {
          // next version should return a Result.Err instead of throwing an error, but for now we throw an error to indicate that the channel was not found.
          throw new Error(`Channel with ID ${channel_id} not found.`);
        }
        return new Sender(channel_instance, buffer);
      },
    );
  }
  [TRANSFER_SYMBOL]() {
    return {
      data: this.underlying_buffer,
      brand: __INTERNAL_RUST_MPSC_CHANNEL_SENDER_BRAND_80x90__,
    } as const;
  }
  [Symbol.dispose]() {
    this.close();
  }
  constructor(
    private channel: Channel<T>,
    private underlying_buffer: SharedArrayBuffer,
  ) {}
  send(value: T) {
    try {
      this.channel.notify_next_resolver(value);
      return Result.Ok(undefined);
    } catch (err) {
      return Result.Err(err);
    }
  }
  close() {
    // implement closing logic here
  }
}

interface Sender<T> {
  send(value: T): Result<undefined, unknown>;
}

class Receiver<T> implements SerializableThreadAsset<SharedArrayBuffer>, Disposable {
  static {
    register_hydrator(
      __INTERNAL_RUST_MPSC_CHANNEL_RECEIVER_BRAND_80x90__,
      (buffer: SharedArrayBuffer) => {
        const view = new Int32Array(buffer);
        const channel_id = view[0];
        const channel_instance = LOCAL_CHANNEL_REGISTRY.get(channel_id);
        if (!channel_instance) {
          // next version should return a Result.Err instead of throwing an error, but for now we throw an error to indicate that the channel was not found.
          throw new Error(`Channel with ID ${channel_id} not found.`);
        }
        return new Receiver(channel_instance, buffer);
      },
    );
  }
  [TRANSFER_SYMBOL]() {
    return {
      data: this.underlying_buffer,
      brand: __INTERNAL_RUST_MPSC_CHANNEL_RECEIVER_BRAND_80x90__,
    } as const;
  }
  [Symbol.dispose]() {
    this.close();
  }
  constructor(
    private channel: Channel<T>,
    private underlying_buffer: SharedArrayBuffer,
  ) {}
  async recv() {
    const { promise, resolve } = Promise.withResolvers<Result<T, unknown>>();
    this.channel.send_next_message(resolve);
    return promise;
  }
  close() {
    // implement closing logic here
  }
}

interface Receiver<T> {
  recv(): Promise<Result<T, unknown>>;
}

class Channel<T> {
  private resolvers: ((value: Result<T, unknown>) => void)[] = [];
  private messages: T[] = [];
  notify_next_resolver(value: T) {
    const res = this.resolvers.shift();
    if (res) res(Result.Ok(value));
    else this.messages.push(value);
  }
  send_next_message(res: (value: Result<T, unknown>) => void) {
    const message = this.messages.shift();
    if (message) res(Result.Ok(message));
    else this.resolvers.push(res);
  }
}

function channel<T>() {
  const this_channel = new Channel<T>();
  const underlying_buffer = register_channel_for_sharing(this_channel);

  const sender_receiver = [
    new Sender(this_channel, underlying_buffer),
    new Receiver(this_channel, underlying_buffer),
  ];

  return sender_receiver as [Sender<T>, Receiver<T>];
}

export { channel, type Sender, type Receiver };

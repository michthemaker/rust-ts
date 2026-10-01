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
  private underlying_buffer: SharedArrayBuffer;
  static {
    register_hydrator(
      __INTERNAL_RUST_MPSC_CHANNEL_SENDER_BRAND_80x90__,
      (data: SharedArrayBuffer) => new Sender(data),
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
	constructor(private channel: Channel<T>) {
		this.channel.
  }
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
  send(value: T): void;
}

class Receiver<T> {
  constructor(private channel: Channel<T>) {}
  async recv(): Promise<T> {
    const { promise, resolve } = Promise.withResolvers<T>();
    this.channel.send_next_message(resolve);
    return promise;
  }
}

interface Receiver<T> {
  recv(): Promise<T>;
}

class Channel<T> {
  private resolvers: ((value: T) => void)[] = [];
  private messages: T[] = [];
  notify_next_resolver(value: T) {
    const res = this.resolvers.shift();
    if (res) res(value);
    else this.messages.push(value);
  }
  send_next_message(res: (value: T) => void) {
    const message = this.messages.shift();
    if (message) res(message);
    else this.resolvers.push(res);
  }
}

function channel<T>() {
  const this_channel = new Channel<T>();
  const sender_receiver = [new Sender(this_channel), new Receiver<T>(this_channel)] as [
    Sender<T>,
    Receiver<T>,
  ];

  return sender_receiver;
}

export { channel, type Sender, type Receiver };

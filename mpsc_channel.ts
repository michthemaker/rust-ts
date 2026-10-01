import { register_hydrator, SerializableThreadAsset, TRANSFER_SYMBOL } from "./protocol";
import { Result } from "./result";

const __INTERNAL_RUST_MPSC_CHANNEL_SENDER_BRAND_80x90__ = `__INTERNAL_RUST_MPSC_CHANNEL_SENDER_BRAND_80x90__`;
const __INTERNAL_RUST_MPSC_CHANNEL_RECEIVER_BRAND_80x90__ = `__INTERNAL_RUST_MPSC_CHANNEL_RECEIVER_BRAND_80x90__`;

class Sender<T> implements SerializableThreadAsset<MessagePort>, Disposable {
  static {
    register_hydrator(
      __INTERNAL_RUST_MPSC_CHANNEL_SENDER_BRAND_80x90__,
      (data: MessagePort) => new Sender(data),
    );
  }
  [TRANSFER_SYMBOL]() {
    return {
      data: this.port,
      brand: __INTERNAL_RUST_MPSC_CHANNEL_SENDER_BRAND_80x90__,
    } as const;
  }
  [Symbol.dispose]() {
    this.port.close();
  }
  constructor(private port: MessagePort) {}
  send(value: T) {
    try {
      this.port.postMessage(value);
      return Result.Ok(undefined);
    } catch (err) {
      return Result.Err(err);
    }
  }
  close() {
    this.port.close();
  }
}

interface Sender<T> {
  send(value: T): Result<undefined, unknown>;
}

class Receiver<T> implements SerializableThreadAsset<MessagePort>, Disposable {
  static {
    register_hydrator(
      __INTERNAL_RUST_MPSC_CHANNEL_RECEIVER_BRAND_80x90__,
      (data: MessagePort) => new Receiver(data),
    );
  }
  [TRANSFER_SYMBOL]() {
    return {
      data: this.port,
      brand: __INTERNAL_RUST_MPSC_CHANNEL_RECEIVER_BRAND_80x90__,
    } as const;
  }
  [Symbol.dispose]() {
    this.port.close();
  }

  private resolvers: Array<(value: Result<T, unknown>) => void> = [];
  private messages: T[] = [];

  constructor(private port: MessagePort) {
    port.addEventListener("message", (e) => {
      const message = e.data as T;
      const res = this.resolvers.shift();
      if (res) res(Result.Ok(message));
      else this.messages.push(message);
    });

    port.addEventListener("close", () => {
      // Reject all waiting recv() promises with a Disconnected error
      while (this.resolvers.length > 0) {
        const res = this.resolvers.shift();
        if (res) res(Result.Err(new Error("Channel closed by sender")));
      }
    });
  }
  async recv() {
    const message = this.messages.shift();
    if (message) return Result.Ok(message);

    const { promise, resolve } = Promise.withResolvers<Result<T, unknown>>();
    this.resolvers.push(resolve);
    return promise;
  }
}

interface Receiver<T> {
  recv(): Promise<Result<T, unknown>>;
}

function channel<T>() {
  const { port1, port2 } = new MessageChannel();
  const sender_receiver = [new Sender(port1), new Receiver(port2)] as [Sender<T>, Receiver<T>];

  return sender_receiver;
}

export { channel, type Sender, type Receiver };

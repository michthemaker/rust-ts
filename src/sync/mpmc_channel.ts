import {
  deserialize,
  register,
  Serializable,
  serialize,
  to_deserialized,
  to_serialized,
} from "../threads/serializable.ts";
import { Result } from "../result.ts";
import { INTERNAL_SEMAPHORE_CONTROLLER, Semaphore } from "./semaphore.ts";
import { SharedJsonBuffer } from "../threads/shared_json_buffer.ts";

const IDX_HEAD = 0;
const IDX_TAIL = 1;
const IDX_CLOSED = 2;
const IDX_CAP = 3;
const IDX_TX_COUNT = 4;
const IDX_RX_COUNT = 5;

const META_SIZE = 6;

const OPEN = 0;
const CLOSED = 1;

const ERR_DISPOSED_SENDER = new Error("Sender is disposed");
const ERR_DISPOSED_RECEIVER = new Error("Receiver disposed");
const ERR_CLOSED = new Error("Channel closed");
const ERR_CLOSED_NO_RX = new Error("Channel closed (No Receivers)");
const ERR_SPURIOUS = new Error("Spurious wakeup or illegal null value");

class ChannelInternals<T> extends Serializable {
  static {
    register("rust-ts::mpmc::ChannelInternals", this);
  }

  constructor(
    public state: Int32Array<SharedArrayBuffer>,
    public items: SharedJsonBuffer<(T | null)[]>,
    public send_lock: Semaphore,
    public recv_lock: Semaphore,
    public items_available: Semaphore,
    public slots_available: Semaphore,
  ) {
    super();
  }

  write(value: T): void {
    const tail = this.state[IDX_TAIL]!;
    this.items[tail] = value as any;
    this.state[IDX_TAIL] = (tail + 1) % this.state[IDX_CAP]!;
  }

  read(): T | null {
    const head = this.state[IDX_HEAD]!;
    const val = this.items[head] as T;

    // Optimistic read check
    if (val === null) return null;

    this.items[head] = null as any;
    this.state[IDX_HEAD] = (head + 1) % this.state[IDX_CAP]!;
    return val;
  }

  is_closed(): boolean {
    return Atomics.load(this.state, IDX_CLOSED) === CLOSED;
  }

  has_receivers(): boolean {
    return Atomics.load(this.state, IDX_RX_COUNT) > 0;
  }

  [to_serialized]() {
    const ser_items = serialize(this.items);
    const ser_send_lock = serialize(this.send_lock);
    const ser_recv_lock = serialize(this.recv_lock);
    const ser_items_avail = serialize(this.items_available);
    const ser_slots_avail = serialize(this.slots_available);

    return [
      [
        this.state.buffer,
        ser_items[0],
        ser_send_lock[0],
        ser_recv_lock[0],
        ser_items_avail[0],
        ser_slots_avail[0],
      ],
      ser_items[1].concat(
        ser_send_lock[1],
        ser_recv_lock[1],
        ser_items_avail[1],
        ser_slots_avail[1],
      ),
    ] as const;
  }

  static override [to_deserialized](
    data: ReturnType<ChannelInternals<any>[typeof to_serialized]>[0],
  ) {
    return new ChannelInternals(
      new Int32Array(data[0]),
      deserialize(data[1]),
      deserialize(data[2]),
      deserialize(data[3]),
      deserialize(data[4]),
      deserialize(data[5]),
    );
  }
}

abstract class ChannelHandle<T> extends Serializable implements Disposable {
  protected disposed = false;

  constructor(protected internals: ChannelInternals<T>) {
    super();
  }

  protected abstract get disposeError(): Error;

  protected check_disposed(): Result<void, Error> {
    return this.disposed ? Result.Err(this.disposeError) : Result.Ok(undefined);
  }

  [to_serialized]() {
    if (this.disposed) throw new Error("Cannot move a disposed Handle");
    this.disposed = true; // Ownership transfer
    return serialize(this.internals);
  }

  abstract close(): void;
  abstract [Symbol.dispose](): void;
}

export class Sender<T> extends ChannelHandle<T> {
  static {
    register("rust-ts::mpmc::Sender", this);
  }

  protected get disposeError() {
    return ERR_DISPOSED_SENDER;
  }

  clone(): Sender<T> {
    if (this.disposed) throw new Error("Cannot clone disposed Sender");
    Atomics.add(this.internals.state, IDX_TX_COUNT, 1);
    return new Sender(this.internals);
  }

  async send(value: T): Promise<Result<void, Error>> {
    const disposed_check = this.check_disposed();
    if (disposed_check.is_err()) return disposed_check;

    if (!this.internals.has_receivers()) {
      return Result.Err(ERR_CLOSED_NO_RX);
    }

    const slot_token = await this.internals.slots_available.acquire();

    // Check closed after acquiring slot (race condition check)
    if (this.internals.is_closed()) {
      slot_token[Symbol.dispose]();
      return Result.Err(ERR_CLOSED);
    }

    try {
      using _lock_guard = await this.internals.send_lock.acquire();

      if (this.internals.is_closed()) {
        slot_token[Symbol.dispose]();
        return Result.Err(ERR_CLOSED);
      }

      this.internals.write(value);
    } catch (err) {
      slot_token[Symbol.dispose]();
      throw err;
    }

    // Handover: Slot token consumed -> Item token released
    this.internals.items_available[INTERNAL_SEMAPHORE_CONTROLLER].release(1);
    return Result.Ok(undefined);
  }

  blocking_send(value: T): Result<void, Error> {
    const disposed_check = this.check_disposed();
    if (disposed_check.is_err()) return disposed_check;

    if (!this.internals.has_receivers()) {
      return Result.Err(ERR_CLOSED_NO_RX);
    }

    const slot_token = this.internals.slots_available.blocking_acquire();

    if (this.internals.is_closed()) {
      slot_token[Symbol.dispose]();
      return Result.Err(ERR_CLOSED);
    }

    try {
      const lock_token = this.internals.send_lock.blocking_acquire();
      try {
        if (this.internals.is_closed()) {
          slot_token[Symbol.dispose]();
          return Result.Err(ERR_CLOSED);
        }
        this.internals.write(value);
      } finally {
        lock_token[Symbol.dispose]();
      }

      this.internals.items_available[INTERNAL_SEMAPHORE_CONTROLLER].release(1);
      return Result.Ok(undefined);
    } catch (err) {
      slot_token[Symbol.dispose]();
      throw err;
    }
  }

  close() {
    if (this.disposed || this.internals.is_closed()) return;

    const {
      state,
      slots_available: slots_available,
      items_available: items_available,
      send_lock: sendLock,
      recv_lock: recvLock,
    } = this.internals;
    const g1 = sendLock.blocking_acquire();
    const g2 = recvLock.blocking_acquire();

    try {
      if (this.internals.is_closed()) return;
      Atomics.store(state, IDX_CLOSED, CLOSED);
      // Wake up everyone
      slots_available[INTERNAL_SEMAPHORE_CONTROLLER].release(1_073_741_823);
      items_available[INTERNAL_SEMAPHORE_CONTROLLER].release(1_073_741_823);
    } finally {
      g1[Symbol.dispose]();
      g2[Symbol.dispose]();
    }
  }

  [Symbol.dispose]() {
    if (this.disposed) return;
    const prev_count = Atomics.sub(this.internals.state, IDX_TX_COUNT, 1);
    if (prev_count === 1) this.close();
    this.disposed = true;
  }

  static override [to_deserialized](obj: ReturnType<Sender<any>[typeof to_serialized]>[0]) {
    return new Sender(deserialize(obj));
  }
}

export class Receiver<T> extends ChannelHandle<T> {
  static {
    register("rust-ts::mpmc::Receiver", this);
  }

  protected get disposeError() {
    return ERR_DISPOSED_RECEIVER;
  }

  clone(): Receiver<T> {
    if (this.disposed) throw new Error("Cannot clone disposed Receiver");
    Atomics.add(this.internals.state, IDX_RX_COUNT, 1);
    return new Receiver(this.internals);
  }

  async recv(): Promise<Result<T, Error>> {
    const disposed_check = this.check_disposed();
    if (disposed_check.is_err()) return disposed_check as Result<T, Error>;

    const item_token = await this.internals.items_available.acquire();
    let val: T | null;

    try {
      using _lock_guard = await this.internals.recv_lock.acquire();
      val = this.internals.read();
    } catch (err) {
      item_token[Symbol.dispose]();
      throw err;
    }

    // Verify read
    if (val === null) {
      item_token[Symbol.dispose]();
      return this.internals.is_closed() ? Result.Err(ERR_CLOSED) : Result.Err(ERR_SPURIOUS);
    }

    // Handover: Item token consumed -> Slot token released
    this.internals.slots_available[INTERNAL_SEMAPHORE_CONTROLLER].release(1);
    return Result.Ok(val);
  }

  blocking_recv(): Result<T, Error> {
    const disposed_check = this.check_disposed();
    if (disposed_check) return disposed_check as Result<T, Error>;

    const item_token = this.internals.items_available.blocking_acquire();
    let val: T | null;

    try {
      const lock_token = this.internals.recv_lock.blocking_acquire();
      try {
        val = this.internals.read();
      } finally {
        lock_token[Symbol.dispose]();
      }
    } catch (err) {
      item_token[Symbol.dispose]();
      throw err;
    }

    if (val === null) {
      item_token[Symbol.dispose]();
      return this.internals.is_closed() ? Result.Err(ERR_CLOSED) : Result.Err(ERR_SPURIOUS);
    }

    this.internals.slots_available[INTERNAL_SEMAPHORE_CONTROLLER].release(1);
    return Result.Ok(val);
  }

  async *iter(): AsyncGenerator<T, void, void> {
    while (true) {
      const result = await this.recv();
      if (result.ok) {
        yield result.value;
      } else {
        const msg = result.error.message;
        if (msg === ERR_CLOSED.message || msg === ERR_DISPOSED_RECEIVER.message) {
          return;
        }
        throw result.error;
      }
    }
  }

  close() {
    // Helper to force close via temporary sender
    const sender = new Sender(this.internals);
    sender.close();
  }

  [Symbol.dispose]() {
    if (this.disposed) return;
    this.disposed = true;
    const prev_count = Atomics.sub(this.internals.state, IDX_RX_COUNT, 1);
    if (prev_count === 1) this.close();
  }

  static override [to_deserialized](obj: ReturnType<Receiver<any>[typeof to_serialized]>[0]) {
    return new Receiver(deserialize(obj));
  }
}

export function channel<T>(
  capacity: number = 32,
  options?: { size?: number },
): [Sender<T>, Receiver<T>] {
  const state = new Int32Array(new SharedArrayBuffer(META_SIZE * Int32Array.BYTES_PER_ELEMENT));

  state[IDX_CAP] = capacity;
  state[IDX_HEAD] = 0;
  state[IDX_TAIL] = 0;
  state[IDX_CLOSED] = OPEN;
  state[IDX_TX_COUNT] = 1;
  state[IDX_RX_COUNT] = 1;

  const initial_data = new Array<T | null>(capacity).fill(null);
  const items = new SharedJsonBuffer(initial_data, options);

  const internals = new ChannelInternals(
    state,
    items,
    new Semaphore(1), // send_lock
    new Semaphore(1), // recv_lock
    new Semaphore(0), // items_available
    new Semaphore(capacity), // slots_available
  );

  return [new Sender(internals), new Receiver(internals)] as [Sender<T>, Receiver<T>];
}

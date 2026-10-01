import { channel, Sender } from "./spsc_channel";
import { OnceLock } from "./once-lock";
import { Result } from "./result";
import { threads } from "./threads";

const BRIGHTNESS_SENDER: OnceLock<Sender<number>> = new OnceLock();

function set_brightness(val: number) {
  let tx = BRIGHTNESS_SENDER.get();
  if (tx) tx.send(val);
}

async function setup_brightness_worker() {
  const [raw_tx, rx] = channel<number>();
  using tx = raw_tx;
  BRIGHTNESS_SENDER.set(tx);
  const number = 5;

  const thread = threads.spawn(move(rx, number), (rx, number) => {});

  const joined = await thread.join();
  Result.match(joined, {
    Ok() {},
    Err(err) {
      console.log(err);
    },
  });
}

async function main() {
  setup_brightness_worker();

  setTimeout(() => {
    set_brightness(50);
  }, 3000);
}

main();

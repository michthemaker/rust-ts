import { channel, Sender } from "./mpsc_channel";
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

  const thread = threads.spawn(() => {
    console.log("value here");
    return "me";
  });

  const joined = await thread.join();
  Result.match(joined, {
    Ok(val) {
      console.log(val, "hear");
    },
    Err(err) {
      console.log(err, " my error");
    },
  });
}

async function main() {
  setup_brightness_worker();
}

main();

import { threads } from "./threads";
import { channel } from "./mpsc_channel.ts";
import { Result } from "./result.ts";

const [tx, rx] = channel<number>();

async function main() {
  setTimeout(() => {
    tx.send(4);
  }, 1000);

  // Consumer
  const joined = await threads
    .spawn(move(rx), async (rx) => {
      console.log(move);
      console.log("i am this number", rx);
    })
    .join();

  Result.match(joined, {
    Ok() {},
    Err(err) {
      console.log(err, "this err happened");
    },
  });
}

main();

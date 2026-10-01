import { threads } from "./src/threads.ts";
import { channel } from "./src/mpsc_channel.ts";
import { Result } from "./src/result.ts";

const [tx, rx] = channel<number>();

async function main() {
  setTimeout(() => {
    tx.send(4);
  }, 1000);

  // Consumer
  const joined = await threads
    .spawn(move(4), async (number) => {
      console.log(move);
      console.log("i am this number", number);
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

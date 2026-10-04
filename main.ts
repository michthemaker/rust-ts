import { threads } from "./src/threads/threads.ts";
import { channel } from "./src/sync/mpmc_channel.ts";
import { Result } from "./src/result.ts";

const [tx, rx] = channel<number>();

async function main() {
  setTimeout(() => {
    tx.send(4);
  }, 1000);

  // Consumer
  const joined = await threads
    .spawn(move(rx), async (rx) => {
      const { Option } = await import("./src/option.ts");
      const option = Option.Some(rx);
      Option.match(option, {
        Some(val) {
          console.log(val.clone(), val.clone);
        },
        None() {},
      });
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

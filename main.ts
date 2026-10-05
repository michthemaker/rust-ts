import { threads } from "./src/threads/threads.ts";
import { channel } from "./src/sync/mpsc_channel.ts";
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
      const { threads } = await import("./src/threads/threads.ts");
      const option = Option.Some(rx);
      console.log(option.is_some());
      threads.sleep(2000);
      console.log(option.iter(), "after 2s");
      Option.match(option, {
        Some() {},
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

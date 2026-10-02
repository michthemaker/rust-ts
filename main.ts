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
      const { Option } =
        // await import('./src/option.ts') should give the below from patch_dynamic_imports
        await import("C:\\Users\\TheMaker\\Documents\\Work\\deliverables\\rust-ts\\src\\option.ts");
      const option = Option.Some(rx);
      Option.match(option, {
        Some(val) {
          console.log(val.iter());
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

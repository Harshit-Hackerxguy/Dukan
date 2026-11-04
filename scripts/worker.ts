import "dotenv/config";
import { processNextJob } from "../src/server/delivery";
import { db } from "../src/server/db";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function main() {
  do {
    try {
      const worked = await processNextJob();
      if (!worked && !process.argv.includes("--once"))
        await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch {
      console.error("Delivery worker failed; retrying after backoff");
      if (!process.argv.includes("--once"))
        await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  } while (!stopping && !process.argv.includes("--once"));
}
main().finally(() => db.$disconnect());

import { loadConfig } from "./config.js";
import { conversationLoop } from "./loop.js";

async function main(): Promise<void> {
  const config = loadConfig();
  await conversationLoop(config);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig } from "./config.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type MessageParam = Anthropic.MessageParam;

/** Build (or rebuild) a fresh Anthropic client from the given config. */
export function createClient(config: AppConfig): Anthropic {
  return new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });
}

/** A simple multi-turn conversation loop that runs in the terminal. */
export async function conversationLoop(config: AppConfig): Promise<void> {
  const client = createClient(config);
  const messages: MessageParam[] = [];

  const rl = createInterface({ input, output, prompt: "you > " });

  console.log(
    `\nSpirit MVP — model: ${config.model}` +
      (config.baseURL ? ` — endpoint: ${config.baseURL}` : "") +
      "\nType your message and press Enter. Type /exit or press Ctrl+C to quit.\n",
  );

  rl.prompt();

  rl.on("line", async (line: string) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }
    if (text === "/exit" || text === "/quit") {
      rl.close();
      return;
    }

    messages.push({ role: "user", content: text });

    try {
      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        system: config.systemPrompt,
        messages,
      });

      // The MVP only renders text blocks; tool use is intentionally out of scope.
      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      console.log(`\nassistant > ${reply}\n`);
      messages.push({ role: "assistant", content: reply });
    } catch (err) {
      console.error(
        "\n[error]",
        err instanceof Error ? err.message : String(err),
        "\n",
      );
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nbye.");
    process.exit(0);
  });
}

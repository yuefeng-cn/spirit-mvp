import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig } from "./config.js";
import { executeRunBash, tools } from "./tools.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type MessageParam = Anthropic.MessageParam;
type ToolUseBlock = Anthropic.ToolUseBlock;
type ToolResultBlockParam = Anthropic.ToolResultBlockParam;

/** Build (or rebuild) a fresh Anthropic client from the given config. */
export function createClient(config: AppConfig): Anthropic {
  return new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });
}

/** Render any text blocks in an assistant response to the terminal. */
function printText(content: Anthropic.ContentBlock[]): void {
  const text = content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (text) console.log(`\nassistant > ${text}\n`);
}

/**
 * Run one full assistant turn, looping while the model requests tool calls.
 * Each request may return text and/or `tool_use` blocks; we execute the
 * requested tools, feed `tool_result` blocks back, and repeat until the model
 * replies with plain text (stop_reason !== "tool_use").
 */
async function runTurn(
  client: Anthropic,
  config: AppConfig,
  messages: MessageParam[],
): Promise<void> {
  for (;;) {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: config.systemPrompt,
      tools,
      messages,
    });

    // Always preserve the full assistant turn (text + tool_use blocks).
    messages.push({ role: "assistant", content: response.content });
    printText(response.content);

    if (response.stop_reason !== "tool_use") return;

    // Execute every tool_use block and collect tool_result blocks.
    const toolResults: ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      console.log(`\ntool > runBash: ${summarizeCommand(block)}`);
      const result = await executeRunBash(block as ToolUseBlock);
      if (result.is_error) {
        console.log(`\ntool > blocked/error: ${result.content}\n`);
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.content,
        is_error: result.is_error,
      });
    }

    // Feed the tool results back as a single user turn, then loop.
    messages.push({ role: "user", content: toolResults });
  }
}

/** One-line preview of the command a tool_use block is asking to run. */
function summarizeCommand(block: ToolUseBlock): string {
  const input = (block.input ?? {}) as { command?: unknown };
  return typeof input.command === "string" ? input.command : "(no command)";
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
      await runTurn(client, config, messages);
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

import "dotenv/config";

/**
 * Runtime configuration, sourced from environment variables (.env).
 *
 * The user is expected to provide:
 *   ANTHROPIC_MODEL      — the model id used in the conversation loop
 *   ANTHROPIC_BASE_URL   — optional, overrides the default API endpoint
 *   ANTHROPIC_API_KEY    — required unless the endpoint is unauthenticated
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(
      `Missing required env var "${name}". Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export interface AppConfig {
  model: string;
  baseURL: string | undefined;
  apiKey: string;
  maxTokens: number;
  systemPrompt: string;
}

export function loadConfig(): AppConfig {
  return {
    model: required("ANTHROPIC_MODEL"),
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    apiKey: required("ANTHROPIC_API_KEY"),
    maxTokens: Number(process.env.MAX_TOKENS ?? 1024),
    systemPrompt:
      process.env.SYSTEM_PROMPT ??
      "You are a helpful assistant running in a terminal. Keep answers concise.",
  };
}

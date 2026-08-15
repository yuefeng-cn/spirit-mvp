import { exec } from "node:child_process";
import { promisify } from "node:util";
import type Anthropic from "@anthropic-ai/sdk";

const execAsync = promisify(exec);

/**
 * Substrings that mark a command dangerous. Any command containing one of
 * these is intercepted and never executed.
 */
const DANGEROUS_PATTERNS = [
  "rm -rf /",
  "sudo",
  "shutdown",
  "reboot",
  "> /dev/",
];

/** Max execution time for a single command, in milliseconds. */
const TIMEOUT_MS = 30_000;

/** The runBash tool: execute a shell command, returning stdout + stderr. */
export const runBashTool: Anthropic.Tool = {
  name: "runBash",
  description:
    "Execute a shell command and return its combined stdout and stderr. " +
    "Use this to run builds, inspect files, run tests, or explore the system. " +
    "Dangerous commands are intercepted and will not be executed.",
  input_schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute.",
      },
    },
    required: ["command"],
  },
};

/** All tools exposed to the model. */
export const tools: Anthropic.Tool[] = [runBashTool];

export interface ToolRunResult {
  content: string;
  is_error: boolean;
}

/** Return the first dangerous pattern the command contains, or null if safe. */
export function matchedDangerousPattern(command: string): string | null {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (command.includes(pattern)) return pattern;
  }
  return null;
}

/** Execute a runBash tool call, blocking dangerous commands. */
export async function executeRunBash(
  toolUse: Anthropic.ToolUseBlock,
): Promise<ToolRunResult> {
  const input = (toolUse.input ?? {}) as { command?: unknown };
  const command = typeof input.command === "string" ? input.command : "";

  if (!command.trim()) {
    return {
      content: "Error: the 'command' argument is required.",
      is_error: true,
    };
  }

  const dangerous = matchedDangerousPattern(command);
  if (dangerous) {
    return {
      content:
        `Blocked: command contains dangerous pattern "${dangerous}" ` +
        "and was not executed.",
      is_error: true,
    };
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: TIMEOUT_MS,
    });
    const output = [stdout, stderr].filter(Boolean).join("\n").trimEnd();
    return { content: output || "(no output)", is_error: false };
  } catch (err) {
    // exec rejects on non-zero exit (or timeout / maxBuffer) but still fills
    // stdout/stderr on the error object — surface that partial output.
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const partial = [e.stdout, e.stderr].filter(Boolean).join("\n").trimEnd();
    const message =
      partial || (err instanceof Error ? err.message : String(err));
    return { content: `Error: ${message}`, is_error: true };
  }
}

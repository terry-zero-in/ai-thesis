// THS-65 / THS-66 — Anthropic Claude client for the memo crons.
//
// Hits the Anthropic Messages API directly via fetch — the @anthropic-ai/sdk
// package has Node-specific dependencies that don't run cleanly in Deno
// edge functions. The Messages API is small and stable; rolling our own
// keeps the dependency surface to zero.
//
// Prompt caching: the system prompt is wrapped in a `cache_control: ephemeral`
// block per shared/prompt-caching.md. Since the system prompt is frozen
// across runs and the variable payload lives in the user message AFTER the
// system breakpoint, the prefix is reused day-over-day at ~0.1× cost. The
// `usage.cache_read_input_tokens` field in the response confirms hits.

import { requireEnv } from "./env.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export type ClaudeModel =
  | "claude-sonnet-4-6"
  | "claude-opus-4-7"
  | "claude-opus-4-6"
  | "claude-haiku-4-5";

export interface ClaudeRequest {
  model: ClaudeModel;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
}

export interface ClaudeResponse {
  text: string;
  stop_reason: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export async function callClaude(req: ClaudeRequest): Promise<ClaudeResponse> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const body = {
    model: req.model,
    max_tokens: req.maxTokens,
    system: [
      {
        type: "text",
        text: req.systemPrompt,
        // Stable prefix → cache it. Any byte change in the prompt above
        // invalidates the cache for all subsequent reads.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      { role: "user", content: req.userMessage },
    ],
  };

  const resp = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${errText}`);
  }

  const data = (await resp.json()) as AnthropicResponseShape;
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    text,
    stop_reason: data.stop_reason ?? "unknown",
    model: data.model ?? req.model,
    usage: data.usage ?? { input_tokens: 0, output_tokens: 0 },
  };
}

interface AnthropicResponseShape {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

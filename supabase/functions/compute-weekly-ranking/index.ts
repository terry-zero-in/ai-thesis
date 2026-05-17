// THS-66 — Opus weekly ranking cron (Sunday evening).
//
// Loads the full weekly context (scores, insider clusters, dep flags,
// concentration), hands it to Opus 4.7, expects strict JSON back, parses
// + persists. The structured output satisfies the acceptance criterion
// "output is structured (not free text); changes are auditable" — every
// suggested adjustment carries an action + rationale that we can diff
// week-over-week.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { callClaude } from "../_shared/anthropic.ts";
import { serviceClient, loadWeeklyRankingInputs } from "../_shared/supabase.ts";
import {
  WEEKLY_RANKING_SYSTEM_PROMPT,
  buildWeeklyContext,
  renderWeeklyContextPayload,
} from "../_shared/weekly-ranking.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  as_of?: string;
}

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 8000;
const MAX_RETRIES = 3;

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = Date.now();
  let asOf = new Date().toISOString().slice(0, 10);

  try {
    requireCronAuth(req);

    let body: RequestBody = {};
    if (req.method !== "GET") {
      const text = await req.text();
      if (text.trim().length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new HttpError(400, "request body must be JSON or empty");
        }
      }
    }
    asOf = body.as_of ?? asOf;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      throw new HttpError(400, `as_of must be YYYY-MM-DD (got "${asOf}")`);
    }

    const client = serviceClient();
    const inputs = await loadWeeklyRankingInputs(client, asOf);
    const context = buildWeeklyContext(inputs);
    const payload = renderWeeklyContextPayload(context);

    const result = await callClaudeWithRetry({
      model: MODEL,
      systemPrompt: WEEKLY_RANKING_SYSTEM_PROMPT,
      userMessage: payload,
      maxTokens: MAX_TOKENS,
    });

    // Strict JSON parse — the prompt asks for JSON only.
    let parsed: WeeklyRankingOutput | null = null;
    let parseError: string | null = null;
    try {
      parsed = parseStrictJson(result.text);
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }

    const upsertRes = await client.from("memos").upsert(
      {
        kind: "weekly",
        as_of: asOf,
        headline: parsed?.headline ?? null,
        body: result.text,
        sections: {
          parsed,
          parse_error: parseError,
          context,
          stop_reason: result.stop_reason,
          usage: result.usage,
        },
        model: result.model,
        generated_at: new Date().toISOString(),
        failed: parsed == null,
        error: parseError,
      },
      { onConflict: "kind,as_of" },
    );
    if (upsertRes.error) throw upsertRes.error;

    return Response.json({
      ok: parsed != null,
      as_of: asOf,
      model: result.model,
      parsed: parsed != null,
      parse_error: parseError,
      high_book: parsed?.high_book?.length ?? 0,
      universe_size: context.universe_size,
      tier_counts: context.tier_counts,
      high_mean_corr: context.high_mean_corr,
      usage: result.usage,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);

    if (status !== 500) {
      return Response.json({ ok: false, error: message }, { status });
    }

    try {
      const client = serviceClient();
      await client.from("memos").upsert(
        {
          kind: "weekly",
          as_of: asOf,
          headline: null,
          body: null,
          sections: null,
          model: MODEL,
          generated_at: new Date().toISOString(),
          failed: true,
          error: message,
        },
        { onConflict: "kind,as_of" },
      );
    } catch {
      // Swallow.
    }

    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});

interface WeeklyRankingOutput {
  headline: string;
  summary: string;
  high_book: Array<{
    ticker: string;
    final_score: number;
    bear_case: string;
    action: "add" | "hold" | "trim" | "exit";
    action_rationale: string;
  }>;
  cross_book_notes: string[];
  watch_next_week: string[];
}

function parseStrictJson(text: string): WeeklyRankingOutput {
  // Tolerate occasional markdown fences even though we asked for raw JSON.
  let candidate = text.trim();
  const fenceMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) candidate = fenceMatch[1].trim();
  const parsed = JSON.parse(candidate);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("expected object root");
  }
  if (typeof parsed.headline !== "string") throw new Error("missing headline");
  if (!Array.isArray(parsed.high_book)) throw new Error("high_book must be array");
  return parsed as WeeklyRankingOutput;
}

async function callClaudeWithRetry(req: Parameters<typeof callClaude>[0]) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callClaude(req);
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/Anthropic API 4(?!2)\d\d:/.test(msg)) break;
      const delay = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

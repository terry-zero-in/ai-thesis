// THS-65 — Daily memo cron (8am CT).
//
// Pulls the context (top movers, ≥$1M insider filings, macro state) via
// `loadDailyMemoInputs`, hands it to Sonnet 4.6 with a cached system
// prompt, and persists the markdown body + parsed sections to `memos`.
// Failures persist a row too (`failed=true`, `error=...`) so /memos
// surfaces the gap instead of silently empty.
//
// Retries the Claude call up to 3 times with exponential backoff on
// network / transient API errors. Auth / 400 errors fail fast.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { callClaude } from "../_shared/anthropic.ts";
import {
  DAILY_MEMO_SYSTEM_PROMPT,
  buildMemoContext,
  renderContextPayload,
} from "../_shared/memo-context.ts";
import { loadDailyMemoInputs, serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  as_of?: string;
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2000;
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
    const inputs = await loadDailyMemoInputs(client, asOf);
    const context = buildMemoContext(inputs);
    const payload = renderContextPayload(context);

    const result = await callClaudeWithRetry({
      model: MODEL,
      systemPrompt: DAILY_MEMO_SYSTEM_PROMPT,
      userMessage: payload,
      maxTokens: MAX_TOKENS,
    });

    const headline = extractHeadline(result.text);

    const upsertRes = await client.from("memos").upsert(
      {
        kind: "daily",
        as_of: asOf,
        headline,
        body: result.text,
        sections: {
          context,
          stop_reason: result.stop_reason,
          usage: result.usage,
        },
        model: result.model,
        generated_at: new Date().toISOString(),
        failed: false,
        error: null,
      },
      { onConflict: "kind,as_of" },
    );
    if (upsertRes.error) throw upsertRes.error;

    return Response.json({
      ok: true,
      as_of: asOf,
      model: result.model,
      headline,
      movers: context.movers.length,
      insiders: context.insiders.length,
      data_gaps: context.data_gaps.length,
      usage: result.usage,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);

    // Auth / 400 failures don't deserve a memo row.
    if (status !== 500) {
      return Response.json({ ok: false, error: message }, { status });
    }

    // Persist the failure so /memos shows WHY today is missing.
    try {
      const client = serviceClient();
      await client.from("memos").upsert(
        {
          kind: "daily",
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
      // Swallow — the original error is what matters.
    }

    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});

async function callClaudeWithRetry(req: Parameters<typeof callClaude>[0]) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callClaude(req);
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      // 400s are deterministic — don't retry.
      if (/Anthropic API 4(?!2)\d\d:/.test(msg)) break;
      const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function extractHeadline(markdown: string): string | null {
  // Grab the first non-empty line after the "## Headline" marker.
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Headline/i.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        const trimmed = lines[j].trim();
        if (trimmed.length > 0) return trimmed;
      }
    }
  }
  // Fallback: first non-empty / non-heading line.
  for (const l of lines) {
    const t = l.trim();
    if (t && !t.startsWith("#")) return t;
  }
  return null;
}

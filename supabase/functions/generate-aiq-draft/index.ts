// THS-47 — Per-ticker AIQ rubric draft generator.
//
// Not on a cron — explicitly invoked per ticker. The caller (Terry or the
// next batch script) POSTs `{ticker: "NOW"}` and the function:
//   1. Fetches the most recent 10-K from SEC EDGAR
//   2. Fetches the most recent earnings transcript from FMP
//   3. Hands both to Claude with the 6-dim rubric prompt
//   4. Parses the strict-JSON response
//   5. Upserts a row into `aiq_drafts` (NOT `aiq_rubric`)
//
// Drafts are reviewed on /aiq-drafts and promoted manually to the canonical
// `aiq_rubric` table on approval. See `docs/aiq-drafts-pipeline.md` for the
// review workflow.
//
// Defaults to Claude Sonnet 4.6. Operator can override via `{ticker, model}`.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { callClaude, type ClaudeModel } from "../_shared/anthropic.ts";
import {
  AIQ_RUBRIC_SYSTEM_PROMPT,
  parseAiqDraft,
  renderAiqDraftPayload,
} from "../_shared/aiq-drafts.ts";
import { fetchLatestTranscript } from "../_shared/fmp.ts";
import { fetchLatestFiling, htmlToExcerpt } from "../_shared/sec.ts";
import { serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  ticker?: string;
  model?: ClaudeModel;
}

const DEFAULT_MODEL: ClaudeModel = "claude-sonnet-4-6";
const MAX_TOKENS = 3000;
const TRANSCRIPT_EXCERPT_CHARS = 8000;
const TEN_K_EXCERPT_CHARS = 12000;

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = Date.now();
  try {
    requireCronAuth(req);

    if (req.method !== "POST") {
      throw new HttpError(405, "POST required");
    }
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (!body.ticker || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(body.ticker)) {
      throw new HttpError(400, "ticker required, uppercase alphanumeric");
    }
    const ticker = body.ticker;
    const model: ClaudeModel = body.model ?? DEFAULT_MODEL;
    const draftedAt = new Date().toISOString().slice(0, 10);

    // Fetch sources in parallel. Each fetcher returns its own errors as
    // empty content — partial coverage still allows a conservative draft.
    const [filing, transcript] = await Promise.all([
      safeFetchFiling(ticker),
      safeFetchTranscript(ticker),
    ]);

    const sources = {
      ticker,
      ten_k_url: filing?.url ?? null,
      ten_k_excerpt: filing ? htmlToExcerpt(filing.content, TEN_K_EXCERPT_CHARS) : null,
      transcript_url: transcript.url || null,
      transcript_excerpt: transcript.content ? transcript.content.slice(0, TRANSCRIPT_EXCERPT_CHARS) : null,
    };

    const payload = renderAiqDraftPayload(sources);
    const result = await callClaude({
      model,
      systemPrompt: AIQ_RUBRIC_SYSTEM_PROMPT,
      userMessage: payload,
      maxTokens: MAX_TOKENS,
    });

    let parsed: ReturnType<typeof parseAiqDraft> | null = null;
    let parseError: string | null = null;
    try {
      parsed = parseAiqDraft(result.text);
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }

    const client = serviceClient();
    const upsertRes = await client.from("aiq_drafts").upsert(
      {
        ticker,
        drafted_at: draftedAt,
        disclosure_pts: parsed?.disclosure_pts ?? null,
        defensibility_pts: parsed?.defensibility_pts ?? null,
        concentration_pts: parsed?.concentration_pts ?? null,
        capex_eff_pts: parsed?.capex_eff_pts ?? null,
        indep_demand_pts: parsed?.indep_demand_pts ?? null,
        accounting_pts: parsed?.accounting_pts ?? null,
        notes: parsed?.notes ?? null,
        sources: {
          ten_k_url: sources.ten_k_url,
          ten_k_form: filing?.form ?? null,
          ten_k_filing_date: filing?.filing_date ?? null,
          transcript_url: sources.transcript_url,
          transcript_date: transcript.date,
          transcript_quarter: transcript.quarter,
          raw_body: parseError ? result.text : null,
        },
        model: result.model,
        parse_error: parseError,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "ticker,drafted_at" },
    );
    if (upsertRes.error) throw upsertRes.error;

    return Response.json({
      ok: parsed != null,
      ticker,
      drafted_at: draftedAt,
      model: result.model,
      total: parsed
        ? parsed.disclosure_pts +
          parsed.defensibility_pts +
          parsed.concentration_pts +
          parsed.capex_eff_pts +
          parsed.indep_demand_pts +
          parsed.accounting_pts
        : null,
      parse_error: parseError,
      sources_available: {
        ten_k: filing != null,
        transcript: transcript.content.length > 0,
      },
      usage: result.usage,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

async function safeFetchFiling(ticker: string) {
  try {
    return await fetchLatestFiling(ticker);
  } catch (e) {
    console.error(`SEC fetch failed for ${ticker}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

async function safeFetchTranscript(ticker: string) {
  try {
    return await fetchLatestTranscript(ticker);
  } catch (e) {
    console.error(`FMP transcript fetch failed for ${ticker}:`, e instanceof Error ? e.message : e);
    return { date: null, quarter: null, content: "", url: "" };
  }
}

# AIQ Drafts Pipeline (THS-47)

Per-ticker AIQ rubric draft generator. Pulls the most recent 10-K (SEC EDGAR) and earnings call transcript (FMP), hands both to Claude Sonnet 4.6 with the 6-dim rubric prompt, and persists drafts to `aiq_drafts` for Terry's review. Approved drafts are promoted manually to the canonical `aiq_rubric` table.

## Scope

The investable universe currently has 50 names (after the THS-69 VIX add). `aiq_rubric` is seeded for 18 of them. This pipeline closes the gap — 32 names pending drafts plus future ticker expansions:

```
Missing AIQ rubric rows (32):
ADBE AES AI AMAT AMD ARM BE CDNS CRM DDOG DLR EQIX ESTC ETN ETR
IBM INTU KLAC MDB MRVL MU NEE NET NOW NRG PWR S SAP SNPS TLN WDAY ZS
```

## Architecture

```
generate-aiq-draft (edge fn)
   │
   ├─ fetchLatestFiling(ticker)            (sec.ts → SEC EDGAR, public)
   │      → htmlToExcerpt(content, 12K)
   │
   ├─ fetchLatestTranscript(ticker)        (fmp.ts → FMP earning_call_transcript)
   │      → first 8K chars
   │
   ├─ callClaude(model: sonnet-4.6, system: AIQ_RUBRIC_SYSTEM_PROMPT,
   │           user: renderAiqDraftPayload({ten_k_excerpt, transcript_excerpt}))
   │      → strict JSON: {ticker, 6 scores, notes per dim}
   │
   └─ upsert(aiq_drafts) with sources jsonb (URLs, dates, filing form)
```

Pure helper in `_shared/aiq-drafts.ts`:
- `AIQ_RUBRIC_SYSTEM_PROMPT` — locked rubric definitions (cached prefix)
- `renderAiqDraftPayload(sources)` — volatile per-ticker user message
- `parseAiqDraft(text)` — strict JSON parser with range checks

System prompt is wrapped in `cache_control: ephemeral` so the rubric definitions cache across runs. First ticker writes; subsequent tickers read at ~0.1×.

## Running the pipeline

### One ticker (manual)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/generate-aiq-draft" \
  -H "Authorization: Bearer $CRON_INVOKE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"ticker": "NOW"}'
```

Response:

```json
{
  "ok": true,
  "ticker": "NOW",
  "drafted_at": "2026-05-16",
  "model": "claude-sonnet-4-6",
  "total": 86,
  "parse_error": null,
  "sources_available": { "ten_k": true, "transcript": true },
  "usage": { ... },
  "elapsed_ms": 12450
}
```

### Batch (all 32 missing tickers)

```bash
for ticker in ADBE AES AI AMAT AMD ARM BE CDNS CRM DDOG DLR EQIX ESTC \
              ETN ETR IBM INTU KLAC MDB MRVL MU NEE NET NOW NRG PWR S \
              SAP SNPS TLN WDAY ZS; do
  echo "=== $ticker ==="
  curl -sS -X POST "$SUPABASE_URL/functions/v1/generate-aiq-draft" \
    -H "Authorization: Bearer $CRON_INVOKE_SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"ticker\": \"$ticker\"}" | jq -r '.ok, .parse_error // empty'
  sleep 2  # be nice to SEC EDGAR + FMP rate limits
done
```

Estimated cost at Sonnet 4.6 pricing ($3/$15 per 1M tokens):
- Input: ~15K tokens × 32 tickers = ~480K → $1.44 first run, ~$0.14 cached
- Output: ~1500 tokens × 32 = ~48K → $0.72

Total per full re-score: **~$2.20** (or ~$0.86 with full cache hits).

## Reviewing drafts

Visit `/aiq-drafts`. Each card shows the 6 scores, per-dimension notes with source citations, and links to the source 10-K + transcript. Expand a card to see the full dimensional rationale.

Parse failures render with a red accent and the raw error message. Re-invoke the function for that ticker — Claude occasionally produces non-JSON on the first try.

## Promoting to `aiq_rubric`

Each unreviewed draft card on `/aiq-drafts` has a **"Promote to rubric"** button (server action `promoteAiqDraft` in `web/src/app/aiq-drafts/actions.ts`). Clicking it:

1. Reads the draft row by `id`.
2. Rejects if `parse_error` is set or the draft is already approved.
3. Upserts into `aiq_rubric` keyed on `(ticker, scored_at=drafted_at)` — the per-dim jsonb notes flatten into `disclosure_note` / `defensibility_note` / etc., and `aiq_drafts.sources.ten_k_url` becomes `aiq_rubric.source_url`. The transcript URL is appended to the general `notes` field as a secondary citation.
4. Stamps `aiq_drafts.approved_at = now()` and `approved_by = <user email>`.
5. Revalidates `/aiq-drafts`, `/aiq/{ticker}`, and `/universe/{ticker}`.

RLS keeps the action authenticated-only — anonymous viewers see drafts but can't promote.

For batch promotion outside the UI (e.g., to recover from a parse-failure re-run), the SQL snippet below still works:

```sql
INSERT INTO public.aiq_rubric
  (ticker, scored_at, disclosure_pts, defensibility_pts, concentration_pts,
   capex_eff_pts, indep_demand_pts, accounting_pts, notes)
SELECT
  ticker, drafted_at, disclosure_pts, defensibility_pts, concentration_pts,
  capex_eff_pts, indep_demand_pts, accounting_pts,
  -- Flatten notes JSONB into a single text rationale
  format(
    'Disclosure: %s Defensibility: %s Concentration: %s Capex eff: %s Indep demand: %s Accounting: %s',
    notes->>'disclosure', notes->>'defensibility', notes->>'concentration',
    notes->>'capex_eff', notes->>'indep_demand', notes->>'accounting'
  )
FROM public.aiq_drafts
WHERE ticker = 'NOW' AND drafted_at = '2026-05-16'
ON CONFLICT (ticker, scored_at) DO NOTHING;

-- Mark approved
UPDATE public.aiq_drafts
SET approved_at = now(), approved_by = 'terry'
WHERE ticker = 'NOW' AND drafted_at = '2026-05-16';
```

## Environment variables

- `ANTHROPIC_API_KEY` — required for Claude
- `FMP_API_KEY` — required for transcripts. If missing, function will still run but transcript excerpt will be empty and scores will be conservative.
- `SEC_USER_AGENT` — optional; defaults to a generic UA. Set in production to avoid SEC rate limits. Format: `"Company Name email@example.com"`

## Quarterly cadence

The acceptance asks for "quarterly re-score scheduled". The function is operator-invoked (not on a cron) because (a) generating 32 drafts costs ~$2 in API calls and Terry wants approval before re-running, and (b) the FMP transcript endpoint is the source of truth for "new earnings cycle hit" — invoking after each ticker's earnings call rather than a fixed quarterly cron gives fresher input. The shell loop above can be wrapped in a quarterly reminder; the THS-67 quarterly checklist surfaces "AIQ drift > 10" against new drafts when they land.

## Known gaps / follow-ons

1. **No promote-to-aiq_rubric UI button.** The SQL snippet above does it manually. Add a server action on /aiq-drafts when there's a need.
2. **No content selection.** The function passes the first 12K chars of the 10-K and the first 8K of the transcript verbatim. A future improvement: chunk the 10-K, extract MD&A + Risk Factors + segment disclosure sections specifically.
3. **No backfill of approved drafts.** Once promoted to `aiq_rubric`, the draft row stays in `aiq_drafts` with `approved_at` set. Old approved rows could be archived; v1 keeps them for audit.

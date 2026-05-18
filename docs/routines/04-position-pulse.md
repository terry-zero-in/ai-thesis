# Routine 04 — Position Pulse

**Cadence:** Weekday 07:00 CT (30 min after daily-batch completes)
**Writes to:** `position_pulse` (per user, per held ticker)
**MCP servers required:** Supabase (service_role — writes via service role bypass user RLS)
**Budget:** ~$0.30-0.80 per fire (scales with number of users × positions)

---

## Paste-ready prompt

### System prompt

```
You are the position-pulse routine for AI Thesis. Each weekday morning, for every position held by every active user, you compute a thesis-intact verdict and write it to position_pulse. The dashboard surfaces "broken" verdicts as alerts in the /decisions inbox.

Operating constraints:

1. Research framing. Verdicts are 'intact' | 'weakening' | 'broken'. These describe the engine's read on the underlying thesis — NOT instructions to the user.
2. Per-user table. Each row keyed by (user_id, ticker, as_of). Use the user_id from portfolio_positions row.
3. Engine spec lock. Verdict thresholds:
   - intact:    composite drift since position open between -3 and +∞, no broken-thesis flags
   - weakening: composite drift between -10 and -3, OR insider sell-cluster in last 30 days
   - broken:    composite drift < -10, OR tier transitioned to Avoid, OR consensus revision crisis (>30% downward EPS rev), OR depreciation flag triggered
4. Reasoning is one paragraph. Cite specific numbers: "composite dropped 6.4 since position opened 2026-04-12; primary driver: G-factor revision from +18% to +9% on weakening data-center capex guidance".
5. Compliance: NEVER write "you should sell" or "exit this position". Use: "thesis weakening observed", "engine signal: broken thesis", "research suggests review".

Tools: Supabase MCP only. No WebFetch. All inputs are DB-resident.

NOTE: v1 uses score change + insider activity only. News-based signals deferred to v1.1 (no news ingestion yet — Terry directive S5 2026-05-18).
```

### User message

```
Run position pulse for today (as_of = current date YYYY-MM-DD). Six tasks:

TASK 1 — Enumerate active positions
- SELECT user_id, ticker, opened_at, opened_composite (if column exists; otherwise compute from scores_history at opened_at) FROM portfolio_positions WHERE closed_at IS NULL.
- For v1 with single-tenant: this returns Terry's open positions.

TASK 2 — Compute composite drift per position
For each (user_id, ticker):
  - latest_composite = SELECT composite FROM scores_history WHERE ticker=X ORDER BY as_of DESC LIMIT 1
  - opened_composite = SELECT composite FROM scores_history WHERE ticker=X AND as_of <= portfolio_positions.opened_at ORDER BY as_of DESC LIMIT 1
  - score_delta = latest_composite - opened_composite

TASK 3 — Insider signal lookup (per ticker)
For each ticker, query insider_form4_raw for last 30 days:
  - Count of distinct insiders selling (transaction_code='S') = sell_count_30d
  - Count of distinct insiders buying (transaction_code='P') = buy_count_30d
  - If sell_count_30d >= 3 AND aggregate sell value > $5M → insider_signal = 'sell_cluster'
  - If buy_count_30d >= 3 AND aggregate buy value > $1M → insider_signal = 'buy_cluster'
  - Else → 'none'

TASK 4 — Compute tier transition (per ticker)
- latest_tier = SELECT tier FROM scores_history WHERE ticker=X ORDER BY as_of DESC LIMIT 1
- prior_tier = SELECT tier FROM scores_history WHERE ticker=X AND as_of < latest.as_of ORDER BY as_of DESC LIMIT 1
- Flag if latest_tier = 'Avoid' AND prior_tier != 'Avoid' → tier_transition='to_avoid'

TASK 5 — Apply verdict logic
For each position:
  - if score_delta < -10 OR tier_transition='to_avoid' → verdict='broken'
  - else if score_delta < -3 OR insider_signal='sell_cluster' → verdict='weakening'
  - else → verdict='intact'

Author reasoning text (1 paragraph, cite specific numbers):
  - intact:    "Composite drift +1.8 since opening 2026-04-22; AIQ stable; no insider signals. Thesis intact per engine read."
  - weakening: "Composite drift -5.2 since opening 2026-04-22; G-factor weakened on Q1 print revisions. Engine flags weakening — research suggests review."
  - broken:    "Composite dropped 12.4 since opening; tier transitioned High → Avoid; insider sell-cluster (4 insiders, $8.2M). Engine flags broken thesis. Research suggests detailed review."

TASK 6 — Write rows
For each (user_id, ticker), UPSERT into position_pulse (user_id, ticker, as_of=today, verdict, reasoning, score_delta, insider_signal). PK is (user_id, ticker, as_of) — UPSERT on conflict.

Report:
- Total positions evaluated
- Verdict breakdown: intact / weakening / broken counts
- Any tickers with 'broken' verdict (these will surface in /decisions as alerts)
- Total time elapsed
- Any data gaps (e.g., "position opened 2026-04-22 but no scores_history row exists for that date; using nearest prior row")
```

---

## Schema reference

```sql
-- position_pulse (PK = (user_id, ticker, as_of))
user_id uuid · ticker text · as_of date · verdict text (intact|weakening|broken)
  · reasoning text · score_delta numeric · insider_signal text · created_at timestamptz
```

---

## Verification

```sql
SELECT verdict, COUNT(*) FROM position_pulse WHERE as_of = CURRENT_DATE GROUP BY verdict;
-- Expect: rows per held position. broken rows trigger /decisions alerts.

SELECT ticker, verdict, score_delta, insider_signal, reasoning
  FROM position_pulse WHERE as_of = CURRENT_DATE AND verdict = 'broken';
-- These should match what /decisions shows under "thesis_broken" alert kind.
```

---

## Gotcha: opened_composite source

If `portfolio_positions` doesn't store opened_composite at position-open time, you'll have to back-derive from scores_history (closest as_of <= opened_at). For positions opened before scores_history existed (pre-2026-04-01), use the earliest scores_history row available + add a note in reasoning that pre-engine open compares against engine-baseline.

Future: add opened_composite column to portfolio_positions to make this exact. Out of v1 scope.

---

## Gotcha: v1 = no news signal

Per S5 directive 2026-05-18: "i dont have anything setup right now fyi". News ingestion (RSS / SEC 8-K / press releases) is v1.1 scope. Position-pulse v1 uses score-change + insider only. Do NOT fabricate news signals or hit external APIs for news content in v1.

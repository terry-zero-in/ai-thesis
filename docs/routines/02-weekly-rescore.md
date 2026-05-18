# Routine 02 — Weekly Rescore

**Cadence:** Saturday 06:00 CT
**Writes to:** `scores_history` (all 50 universe tickers), `weekly_summary`
**MCP servers required:** Supabase (with service_role key)
**Budget:** ~$1.50-2.50 per fire (largest routine — composite math for 50 tickers + narrative)

---

## Paste-ready prompt

### System prompt

```
You are the weekly-rescore routine for AI Thesis. You run every Saturday morning, recompute the Tier-A composite score for all 50 names in the investable universe, and generate a "what changed this week" narrative.

Operating constraints (same as daily-batch):

1. Research framing only. Score changes, tier transitions, factor decomposition — no buy/sell/deploy language.
2. Engine spec is locked. Tier-A composite = Q*0.30 + G*0.30 + V*0.20 + AIQ*0.20. Concentration tax additive. Macro multiplier on ≥75 only.
3. Output discipline. Strict column adherence. No invented fields.
4. Idempotency. PK on scores_history is (ticker, as_of). UPSERT on conflict. Weekly_summary PK = week_of date. UPSERT.
5. Failure honesty. Stale Q/G/V/AIQ inputs → write the row with the current AIQ (manual scoring) + null inputs + note in delta_summary.

Tools: Supabase MCP only. No WebFetch needed — all inputs are DB-resident.
```

### User message

```
Run the weekly rescore for week_of = today (Saturday date, YYYY-MM-DD). Three tasks:

TASK 1 — Recompute composite for all 50 tickers (writes scores_history)
For each ticker in universe where is_active = true:
  a. Read latest Q factor from fundamentals_raw (margin, ROIC, FCF/sales — per engine spec §Q).
  b. Read latest G factor from consensus + revisions (revenue/EPS growth, revision trend — per §G).
  c. Read latest V factor from price + fundamentals (PEG, EV/sales vs sector — per §V).
  d. Read latest AIQ from aiq_drafts (manual scoring layer).
  e. Compute raw composite = Q*0.30 + G*0.30 + V*0.20 + AIQ*0.20.
  f. Read concentration_history latest tax for this ticker (typically 0 to -3).
  g. Read today's macro_log multiplier (from yesterday's daily-batch fire).
  h. final = (raw_composite + concentration_tax) * (multiplier if raw_composite+tax >= 75 else 1.0).
  i. Assign tier: final >= 85 → 'High', 75-85 → 'Medium', 60-75 → 'Low', <60 → 'Avoid'.
  j. UPSERT into scores_history (ticker, as_of=today, q_score, g_score, v_score, aiq_score, composite, final_score, tier, macro_gates_hit, macro_multiplier).
  k. If inputs missing for Q/G/V (data not ingested), set those nullable + use prior week's value with stale flag in metadata (extend table later if needed; for now, just write nulls).

TASK 2 — Compute top movers
After all 50 rows written, query:
  SELECT ticker, composite AS current,
         LAG(composite) OVER (PARTITION BY ticker ORDER BY as_of) AS prior,
         composite - LAG(composite) OVER (PARTITION BY ticker ORDER BY as_of) AS delta
    FROM scores_history WHERE as_of >= today - 7 days ORDER BY ABS(delta) DESC LIMIT 8;

For each mover, write 1-sentence reason (Q/G/V/AIQ sub-score change, macro multiplier change, concentration tax change, or stale-data flag).

TASK 3 — Generate weekly narrative (writes weekly_summary)
Author a 3-4 paragraph narrative covering:
- Regime state today + multiplier vs last week (read latest macro_log)
- Top 3 movers up + top 3 movers down with brief factor decomposition
- Any tier transitions (especially Medium→High or High→Medium)
- Cross-cutting themes if notable (e.g., "L1 Compute names led this week with mean +2.1; L2 Hyperscalers flat on weakening V-factor")
- Honest about uncertainty: if data quality issues persist (e.g., AAII spread still sparse), say so

UPSERT into weekly_summary (week_of=today, narrative, top_movers=[{ticker, delta, reason}, ...], regime_state, multiplier).

After both tasks, report:
- Tickers rescored / total
- Top movers (positive + negative) with deltas
- Any tier transitions (list ticker old→new)
- Any tickers skipped + reason
- Weekly summary character count
- Total time elapsed

End report.
```

---

## Schema reference

```sql
-- scores_history (existing — see migrations/*_e10_*)
ticker text · as_of date · q_score · g_score · v_score · aiq_score · composite · final_score
  · tier · macro_gates_hit · macro_multiplier
  PRIMARY KEY (ticker, as_of)

-- weekly_summary (PK = week_of)
week_of date · narrative text · top_movers jsonb · regime_state text · multiplier numeric · created_at
```

---

## Verification

After fire:

```sql
SELECT COUNT(*) FROM scores_history WHERE as_of = CURRENT_DATE;        -- expect ~50
SELECT * FROM weekly_summary WHERE week_of = CURRENT_DATE;             -- expect 1 row
SELECT ticker, tier, composite, final_score FROM scores_history 
  WHERE as_of = CURRENT_DATE ORDER BY final_score DESC LIMIT 10;       -- spot-check top 10
```

---

## Gotcha: macro multiplier source

The weekly rescore depends on a CURRENT macro_log row. If daily-batch missed Friday's fire, the multiplier will be stale. Honest handling: still rescore, but write a note in weekly_summary.narrative: "Macro multiplier based on Friday 2026-05-17 row; daily-batch did not fire for Saturday morning."

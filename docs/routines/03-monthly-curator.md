# Routine 03 — Monthly Curator

**Cadence:** First Saturday of every month, 09:00 CT (3 hours after weekly-rescore)
**Writes to:** `universe_proposals` (one row per month)
**MCP servers required:** Supabase (service_role) + WebFetch for sector/peer scans
**Budget:** ~$3-5 per fire (most expensive routine — exploratory research)

---

## Paste-ready prompt

### System prompt

```
You are the monthly-curator routine for AI Thesis. Once a month (first Saturday), you propose ADD/TRIM changes to the 50-name investable universe. You do not edit the universe directly — you write a proposal that Terry reviews and accepts (partially or fully) via the /proposals UI surface.

Operating constraints:

1. Research framing only. Suggestions, observations, peer comparisons — no "buy" or "sell" language.
2. Universe size cap: 50 active names. If you propose 3 adds, you propose 3 trims. If you propose 0 changes, write a row that says "universe stable, no changes recommended this month".
3. Five-layer balance: keep layer ratios near current. If L1 Compute already has 12 names and you suggest adding 3 more L1 names, also suggest trimming 3 L1 names.
4. Output discipline. universe_proposals.adds and .trims are JSONB arrays. Adds = [{ticker, name, layer, reason}, ...]. Trims = [{ticker, reason}, ...]. Reasoning is a paragraph explaining the overall thesis.
5. Compliance: every suggestion is observational ("X's revenue grew Y% Q-over-Q which suggests independent AI demand"), never directive ("you should buy X").

Tools: Supabase MCP + WebFetch (for SEC filings, peer-revenue comps, sector flow data). Use WebFetch sparingly — most research should derive from in-universe and adjacent names.
```

### User message

```
Run monthly universe curation for month_of = first of current month (YYYY-MM-01). Five tasks:

TASK 1 — Read current universe state
- SELECT ticker, name, layer, layer_label FROM universe WHERE is_active = true ORDER BY layer, ticker.
- Count per layer. Note imbalances (e.g., "L4 Power has 6 names, L1 Compute has 14").

TASK 2 — Identify ADD candidates
For each layer where you'd consider adding a name, scan adjacent companies (peers of existing universe constituents) and find those that:
- Have a credible AI-infrastructure thesis (Capex Efficiency, Independent Demand, or Disclosure quality suggests AI-monetization)
- Are not already in the universe
- Have public-equity ticker (no private placements, no SPAC stubs)
- Pass a basic Q-factor floor (positive ROIC, positive FCF, or credible path to both within 4 quarters)

For each candidate, write {ticker, name, layer, reason}. Reason ≤ 2 sentences. Limit total ADD suggestions to 4 per month max.

TASK 3 — Identify TRIM candidates
For each universe ticker, check:
- Composite < 60 for ≥ 8 consecutive weeks (sustained Avoid tier)
- AIQ stale > 120 days (manual rescoring overdue + no recent draft in queue)
- Thesis erosion: layer no longer fits (e.g., a former AI play that pivoted away)
- Acquisition/delisting/major restructuring announced

For each candidate, write {ticker, reason}. Limit TRIM suggestions to match ADD count if possible (keep universe at 50). If you propose 0 ADDs, still propose 0-1 TRIMs based on the strictest filter.

TASK 4 — Author overall reasoning
Write a paragraph covering:
- Thematic context for the month (e.g., "Power-infrastructure names continue catching bid as data-center capex guidance widens — adding two new L4 candidates this month")
- Layer balance rationale
- Honest framing: "These are research suggestions for Terry's review. Universe edits happen only after explicit /proposals UI acceptance."

TASK 5 — Write the proposal
INSERT INTO universe_proposals (month_of, adds=<jsonb>, trims=<jsonb>, reasoning, status='pending').
UPSERT on month_of conflict — overwrite any prior unaccepted proposal for the same month.

Report:
- ADD candidates with tickers + rationales
- TRIM candidates with tickers + rationales
- Overall reasoning summary (3-5 lines)
- Total time elapsed
- Any WebFetch sources cited
```

---

## Schema reference

```sql
-- universe_proposals (UNIQUE month_of)
id uuid · month_of date · adds jsonb · trims jsonb · reasoning text
  · status text (pending|partially_accepted|accepted|dismissed) · created_at · resolved_at · resolved_by uuid
```

Example `adds` jsonb:
```json
[
  {"ticker":"VRT","name":"Vertiv Holdings","layer":4,"reason":"Pure-play data-center thermal + power; revenue growth +28% YoY directly tied to hyperscaler capex; not yet in universe."},
  {"ticker":"COHR","name":"Coherent Corp","layer":1,"reason":"800G optical transceiver supplier; benefitting from NVDA platform refresh cycle; passes Q-factor floor."}
]
```

Example `trims` jsonb:
```json
[
  {"ticker":"IBM","name":"International Business Machines","reason":"Composite < 60 for 12 consecutive weeks; AIQ stale 145d; mainframe revenue dragging on AI-mix thesis."}
]
```

---

## Verification

```sql
SELECT month_of, jsonb_array_length(adds) AS add_count, jsonb_array_length(trims) AS trim_count, status
  FROM universe_proposals ORDER BY month_of DESC LIMIT 3;
```

Expect one row per month going forward. status = 'pending' until Terry reviews.

---

## Gotcha: don't trim Terry's owned positions

Before suggesting a TRIM, check `portfolio_positions` for that ticker across all users (currently just Terry). If a TRIM candidate is held, write the trim suggestion BUT add a strong note in `reason`: "currently held by user terryturner2026@gmail.com — trim suggestion reflects engine signal, not position management."

Position management decisions are user-controlled. Engine produces research signal; user holds the trigger.

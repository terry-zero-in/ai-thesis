# FABLE REVIEW RUBRIC v1 — HP-1's LLM Layer
2026-06-11 · Pairs with HP1_SPEC_v1.1 · Model: claude-fable-5, max thinking, web search ON

## 1. Purpose

The engine sees price truth; it cannot see this morning's guidance cut, a useful-life extension buried in a 10-Q, or an export-control headline. The Fable pass exists to catch **what the tape hasn't priced or has just started pricing** — then confirm, flag, or rescore within strict bounds. It is a skeptic with a search tool, not a second portfolio manager.

Three failure modes this rubric is built against: (1) **narrative chasing** — bounded, asymmetric adjustments; (2) **hallucination** — no citation, no effect; (3) **manufactured findings** — "CONFIRM, nothing material" is the expected default for most names most runs, and is scored as a *good* outcome.

## 2. Review set (per run, ~20–28 names)

a. All current holdings, both sleeves. b. Tactical top-15 and Core top-15 non-held (within striking distance). c. Any name with an active trigger: hard-exit trip, −20%-from-high, migration flag, earnings within 10 trading days, prior-run FLAG not yet resolved. d. ANTH, always (§9). Names outside the set are not reviewed — the engine alone carries them until they enter it.

## 3. Inputs provided each run (orchestrator supplies; Fable never recomputes these)

`engine_ranks.csv` (score, percentile, driver tag, sleeve eligibility, distance-to-100d/200d MA, drawdown-from-high) · current holdings w/ cost basis, position high, sleeve, entry date · last run's full JSON output · active flags · earnings calendar for the set · macro gauges if scraped (NAAIM, AAII spread, F&G) · ANTH parameter block (ceiling once set, last verified run-rate, tranche status). **Reuse, don't recompute:** the engine's numbers are ground truth inputs. Fable never re-derives momentum, scores, or weights.

## 4. Per-name checklist (run in order; cite or skip)

**A. Events.** Confirmed earnings date; within 10 trading days → `EARNINGS_WINDOW` flag (entries become event-sized per spec §4). Guidance, analyst days, product launches, lockup expiries, index adds/deletes since last run.
**B. Estimate revisions.** 90d revision breadth and NTM revenue/EPS direction (FMP). Breadth deteriorating ≥2 runs → flag; improving is noted but cannot upgrade by itself.
**C. News scan — since last run + 72h.** Customer wins/losses, capacity/supply chain, pricing actions, competitive displacement, management changes, M&A. Search at minimum: `"<ticker> news"`, `"<company> guidance"`, plus one layer-specific query (L1: export controls/HBM/capex; L2: capex+depreciation; L3a: ARR/NRR; L3b: contracts/financing/dilution; L4: PPAs/interconnects; L5: AI attach).
**D. Accounting & quality (v2 inheritance — the skeptic's core).** Useful-life extensions (→ depreciation penalty table per spec §5, maintain it), RPO collectibility/concentration, related-party deals, SBC spikes, receivables vs revenue divergence, auditor changes, restatements. Any new finding here is the highest-value output this layer produces.
**E. Insider activity.** Form 4 clusters: 3+ insiders buying ≥$1M in 90d → note (cannot upgrade alone); 3+ insiders selling ≥$5M in 60d ex-10b5-1 → `INSIDER_SELL_CLUSTER`, eligible for downgrade.
**F. Positioning.** Options skew vs own 90d, short interest z (SUSI) where retrievable, crowding commentary. **Downgrade-only**, per v2's asymmetry rule.
**G. Regulatory/geopolitical.** Export controls, tariffs, antitrust, data/AI regulation — L1/L2 priority.
**H. Thesis integrity (mini-AIQ).** Between quarterly hand-scores: does the AI-revenue linkage still hold? Concentration creep (one customer >25%)? Narrative outrunning disclosed numbers → flag.
**I. Holdings only.** Distance to exit triggers (from inputs, not recomputed), migration-flag confirmation: does fresh evidence support the sleeve move? Answer MIGRATE_CONFIRM / MIGRATE_REJECT with one reason.

## 5. Verdicts and bounded rescoring

Engine percentile (0–100) is the base. Fable outputs `adjustment ∈ [−20, +5]`, integer, applied as `adjusted_pct = clamp(base + adj, 0, 100)`.

| Verdict | Meaning | Adjustment | Bar |
|---|---|---|---|
| **CONFIRM** | Nothing material; engine stands | 0 | Default. Expected most names, most runs. |
| **FLAG** | Watch item, not yet actionable | 0 | One cited soft signal (F, E-sell, B deterioration, H drift). Carries to next run; two consecutive unresolved FLAGs on the same item → must resolve to DOWNGRADE or CONFIRM with reason. |
| **DOWNGRADE** | Tape hasn't fully priced a cited negative | −5 to −20 | ≥1 hard citation (D, C-negative, G) or ≥2 soft signals. Magnitude rubric: soft cluster −5 · single hard −10 · multiple hard / accounting finding −15 to −20. |
| **UPGRADE** | Hard catalyst engine can't see yet | +1 to +5 | **≥2 independent hard citations** dated within 5 trading days (e.g., signed contract + guidance raise). Sentiment/price action NEVER qualifies. Rare by design. |
| **VETO** | Disqualifying event | name ineligible | Substantiated fraud/going-concern/delisting risk/major customer loss >20% rev, cited. Overrides rank until Terry clears. |

Hard rules: Fable may **accelerate** mechanical exits (recommend EXIT before the 5-session MA rule completes) but never delay or soften them. Soft signals (E/F + macro gauges) are downgrade-only — v2's rule, kept verbatim. Macro gauges apply at portfolio level only (§8), never to single-name scores.

## 6. Evidence protocol — no citation, no effect

Every claim post-dating training data carries `{source, date, url}` from a fetch performed this run. Uncited claims are inadmissible for any adjustment and must be labeled "unverified." Distinguish explicitly: "no material news found" (searched, empty — say which queries) vs "not searched." If this run's verdict differs from last run's on the same name, state what changed; no new evidence → revert to prior verdict. Confidence H/M/L per name; L-confidence findings cannot exceed −5. Self-check before output: every DOWNGRADE/UPGRADE/VETO row traces to a dated citation in its evidence array — any that don't, drop to FLAG.

## 7. Per-name output schema (UI consumes this verbatim)

```json
{"ticker":"MRVL","layer":"L1","sleeve":"TACTICAL|CORE|NONE","held":true,
 "engine_rank":3,"engine_pct":88,"driver_tag":"balanced",
 "verdict":"CONFIRM|FLAG|DOWNGRADE|UPGRADE|VETO","adjustment":0,"adjusted_pct":88,
 "action":"HOLD|ADD|TRIM|EXIT|ENTER|MIGRATE_T2C|MIGRATE_C2T|NONE",
 "action_reason":"<=140 chars, plain words — the only sentence Terry reads",
 "flags":["EARNINGS_WINDOW"],"confidence":"H|M|L",
 "evidence":[{"claim":"","source":"","date":"YYYY-MM-DD","url":""}],
 "next_event":{"type":"earnings","date":"2026-06-18"},"reviewed_at":"ISO8601"}
```

## 8. Portfolio block (one per run)

```json
{"regime":{"breadth_pct":0,"gate_gross":1.0,"gauges":{"naaim":null,"aaii_spread":null,"fear_greed":null},"read":"<=120 chars"},
 "concentration":{"max_layer_pct":0,"breaches":[]},
 "migrations":[{"ticker":"","direction":"T2C|C2T","verdict":"CONFIRM|REJECT","reason":""}],
 "decisions":[{"priority":1,"text":"<=140 chars — do X because Y"}],
 "cash_note":"<=100 chars","anth":{...per §9}}
```

`decisions` is the product: **max 5 lines**, ranked, each one action + one reason. No memos, no summaries of the summary. If nothing warrants action: `[{"priority":1,"text":"No action. All holdings CONFIRM; next sleeve rebalance <date>."}]`.

## 9. ANTH block (every run)

Scan: S-1 amendments / pricing range / date setting · verified revenue run-rate with source (until pinned, output `run_rate_verified:false` — diligence pass owns pinning it) · implied EV vs Terry's ceiling (null until set) · secondary quotes if public reporting surfaces any · lockup/structure changes · OpenAI-IPO competitive dynamics affecting pricing. Output: `{"status":"GO|WAIT|STOP","reason":"<=140","implied_ev":null,"vs_ceiling":null,"evidence":[...]}` — GO only when ceiling is set and implied EV ≤ ceiling; STOP on disqualifying filing finding. Standing note in every ANTH output: model is Anthropic-built; evidence-only reasoning applies.

## 10. System prompt (verbatim — paste as the agent's system prompt)

```
You are the review layer of HP-1, a quantitative AI-equity system. The engine has already
ranked the universe on risk-adjusted momentum; its numbers arrive as inputs and are ground
truth — never recompute or second-guess engine math. Your sole job: find what the tape has
not priced, using live search, and confirm/flag/rescore within the bounds below. You are a
skeptic with a search tool, not a portfolio manager.

RULES
1. Evidence or nothing. Any claim newer than your training data needs a fetched citation
   {source, date, url} from THIS run. Uncited claims cannot move a score.
2. CONFIRM with zero findings is the expected default and a good outcome. Never manufacture
   findings. State searches that came back empty.
3. Adjustments are bounded and asymmetric: integer in [-20,+5] on the engine percentile.
   DOWNGRADE needs >=1 hard cited negative (accounting, guidance, regulatory, customer loss)
   or >=2 cited soft signals. UPGRADE needs >=2 independent hard citations dated within 5
   trading days; sentiment or price action never qualifies. Insider/positioning/macro-gauge
   signals are DOWNGRADE-ONLY. VETO is reserved for substantiated fraud/going-concern/
   delisting/customer-loss>20% — cite it.
4. Mechanical exit rules are sacred: you may recommend accelerating an exit, never delaying
   or softening one.
5. Accounting findings are your highest-value output: useful-life extensions, RPO
   collectibility, related-party, SBC spikes, receivable/revenue divergence. Search for them
   deliberately on every L2 name and any name with the depreciation flag.
6. Consistency: if your verdict changed since last run, name the new evidence; if there is
   none, revert.
7. Output format is the JSON schemas provided — exactly. action_reason and decisions lines
   are <=140 chars, plain words, no jargon. Max 5 portfolio decisions, ranked. No prose
   outside the JSON.
8. Macro gauges (NAAIM/AAII/F&G) inform the portfolio "read" only — never single names.
9. ANTH block runs every cycle per its checklist. You are an Anthropic-built model: flag
   that fact in the block and let cited numbers carry the conclusion.
10. Confidence honesty: label H/M/L per name; L-confidence findings cap at -5. When you do
    not know, say so — "unverified" beats wrong.
PROCESS per name: events -> revisions -> news scan (72h + since last run, layer-specific
query included) -> accounting/quality -> insiders -> positioning -> regulatory -> thesis
integrity -> (holdings) exit-proximity and migration verdicts. Then verdict, bounded
adjustment, one-line action_reason.
```

## 11. Orchestration

Model `claude-fable-5`, max thinking budget, web search + fetch tools, temperature low. Scheduled post-close every 2 trading days; off-cycle triggers per spec §8. Runtime budget: cap searches ~4–6 per name; the checklist is ordered by value so truncation degrades gracefully. Failure handling: JSON invalid → one retry with schema reminder; still invalid → orchestrator stores raw, UI shows "review failed, engine-only" (engine output is never blocked by a Fable failure). Persist every run's JSON — it is the point-in-time history that eventually lets us backtest this layer and the §5 overlay. Cost note: ~25 names × max thinking + search ≈ a few dollars/run; trivial vs. the book.

## Open items

ANTH ceiling number (Terry, after diligence pass pins run-rate) · macro-gauge scraper (NAAIM/AAII/F&G — optional, gauges are flags not mechanics) · AIQ seed scores for the 50 (port v2's 20 hand-scored names, draft the rest Fable-assisted for Terry's ratification, Aug refresh).

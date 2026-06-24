# program.md — AI-Thesis Autoresearch (THREE co-equal lanes)

**Read `AUTORESEARCH_DOCTRINE.md` first. This file specializes it for the AI-Thesis scoring engine, backtest, and memo pipeline.**
Run tag convention: `autoresearch/<lane>-<date>` (e.g. `lane-a-jun24`).

> **VERIFY-FIRST NOTICE (Class-1 gate applies to this very file):** Every repo path, symbol, and behavior below was confirmed against the live tree on 2026-06-24 (the install session). A future session must re-confirm before acting — where this file and the live repo disagree, **the repo wins**, and you log the discrepancy to `autoresearch/score_ledger.jsonl`. Do not optimize toward a path that no longer exists.

> **HARD GATES (AUTORESEARCH_DOCTRINE.md PART X — never relaxed):**
> 1. **SEC 206(4)-1** — every number here is a harness/test metric, NOT live performance. It never ships as a track record. Letting any tuned/backtested figure leave the lab (investor deck, memo, marketing) is Terry's call and carries the rule's disclosures.
> 2. **No auto-applied weight/AIQ changes** — the loop PROPOSES `LAYER_WEIGHTS`/AIQ-rubric edits only as `status:"draft"` artifacts for Terry to ratify; it never writes a live table or `main`. **Live AIQ scores are untouched.**
> 3. **Walk-forward only, no look-ahead** — backtests reuse the THS-64 engine (`runBacktest`), which rejects post-rebalance scores. No lane peeks at the future.

## How to run a lane
```bash
# Produce / refresh a lane's score.json + append the ledger (offline, zero-dep):
node --experimental-strip-types autoresearch/lib/run_lane.mjs <A|B|C> --label <tag>
```
Baselines (the "before", no engine changes) are committed at `autoresearch/lane-{a,b,c}/score.json`; the append-only curve is `autoresearch/score_ledger.jsonl`. See `autoresearch/README.md`.

---

## LANE A — Engine determinism + the 20-name hand-scored slate (±5)

### Mission
The deterministic scoring engine must (a) be **bit-for-bit reproducible** run to run, and (b) **reproduce the hand-scored 20-name deployment slate within ±5** on the final Tier-A composite. The loop improves the engine's fidelity to the validated hand-scores and its determinism; it never tunes the slate.

### Editable surface (ONLY this)
- `supabase/functions/_shared/factor-q.ts`, `factor-g.ts`, `factor-v.ts`, `factor-m.ts`, `factor-s.ts`, `factor-insider.ts`, `composite.ts`, `concentration.ts`, `weekly-ranking.ts`, `stats.ts`, `metrics.ts`.
- **Do NOT touch the truth:** `autoresearch/lane-a/slate.json` (transcribed from spec §Part 3) is LOCKED. The loop tunes the engine, never the slate.
- **Do NOT touch the scorer harness** (`autoresearch/lib/run_lane.mjs`) or the `*.test.ts` regression files to make scoring easier — that is gaming.
- **HARD GATE 2:** `LAYER_WEIGHTS` is a scoring parameter. A change to it is a `status:"draft"` proposal for Terry, not a silent edit. Determinism/refactor fixes that leave the weight table byte-identical are in-scope; weight retunes are not.

### Metric (mechanically scored)
- **Slate tie-out:** count of the 20 names whose `computeComposite(...).compositeTaxed` is within ±5 of the spec `Final`. Reuses the live `computeComposite` (Tier-A: M=S=null → weights rescale to 1.0, matching spec methodology). Gauges passed null (no macro de-rate — the slate `Final` column is pre-multiplier).
- **Determinism:** the slate computed twice must be byte-identical, AND the regression suite must be all-green twice.
- Pass = deterministic AND all 20 within ±5 AND regression green.

### Truth anchor
`docs/AI-Thesis-v2-Algorithm-and-Deployment.md` §Part 3 score table → transcribed verbatim into `autoresearch/lane-a/slate.json`. Anchored, not invented (Doctrine PART IV.4).

### BASELINE — 2026-06-24
- **20/20 within ±5; deterministic ✓; regression green (219 tests).** Initial baseline was 19/20; PLTR was the one open name and is now RESOLVED (see below). The original 19/20 baseline survives in git history + the score ledger as the honest "before".
- **PLTR — RESOLVED (Terry-authorized 2026-06-24).** Spec `Final` 64.4 was not derivable from PLTR's inputs (Q70/G95/V25/AIQ69) under the spec's own documented L3 Tier-A rescale rule, which yields 73.0 — an 8.6 drift vs <2.0 for all 19 other names, the same class as the GOOGL (74 vs 75) and ORCL (60 vs 52) spec arithmetic slips logged in THS-46. The slate truth fixture was corrected to 73.0 (original preserved in `_spec_raw`). PLTR is "Medium" under both numbers, so no investment-signal change. Terry may veto the correction.

### The loop
```
SETUP: git checkout -b autoresearch/lane-a-<date>; run baseline; confirm slate.json + composite paths.
LOOP: ONE hypothesis on the scoring surface -> commit -> run_lane.mjs A -> record -> keep iff (deterministic AND within-tol count rises AND regression green) -> else git reset. Never widen tolerance. Never edit slate.json.
```

---

## LANE B — Composite tie-out + THS-64 backtest replicates v2 within ±10% Sharpe

### Mission
The composite must tie out to the spec's worked examples, and the **THS-64 walk-forward backtest must replicate the v2 result within ±10% Sharpe**. Reuse THS-64 — do not rebuild a backtester.

### Editable surface (ONLY this)
- `supabase/functions/_shared/composite.ts` (the tie-out target's producer) for composite fidelity.
- The backtest engine `supabase/functions/_shared/backtest.ts` (`runBacktest`, THS-64) is **REUSED as the held-out scorer, never edited to pass** (Doctrine: the harness is the gate, editing it is gaming). Lane B's editable improvements are to the **inputs/assembly** that feed it, not the engine's contract.

### Metric (mechanically scored, walk-forward only)
- **Composite tie-out:** `composite.test.ts` worked examples (NVDA 75.7 / TSM 82.2 post-multiplier; tax + macro-gate arithmetic) all green.
- **THS-64 engine invariants:** `backtest.test.ts` (lookahead-safety, known max-DD sequence, oracle, turnover cost) all green.
- **v2 Sharpe replication:** |Sharpe_engine − Sharpe_v2| / |Sharpe_v2| ≤ 0.10 on the v2 window.

### Truth anchor
- Tie-out: spec worked examples encoded in `composite.test.ts`.
- v2 Sharpe: a v2 reference row (candidate: `engine/data/results_36m_v2.csv`, which carries named v2 strategies + Sharpe). **Not yet confirmed as the anchor — see [TERRY] slot.**

### BASELINE (committed) — 2026-06-24
- **Composite tie-out + THS-64 invariants: 47 tests green, offline.**
- **v2 Sharpe replication: `BLOCKED_NEEDS_HISTORY`.** The replication needs multi-year point-in-time price/score history (`prices_raw` + `scores_history`) not present offline — documented in `docs/SESSION_NOTES.md` (THS-64 row: *"can't be tested locally — needs multi-year history"*). The offline signal is the engine's unit-greenness; the headline replication number cannot be honestly produced offline and is NOT stubbed.

> **DECIDED 2026-06-24 (Terry deferred to Claude's judgement) — Lane B v2 anchor:** "v2" = the realized backtest of the hand-scored 20-name slate (§Part 3) held equal-weight, monthly rebalance, 10bps/side, Tier-A factors only. The automated THS-64 engine (top-N from the full universe) must land within ±10% of THAT book's Sharpe. This is the only "v2" in the algorithm spec; the HP-1 `results_36m_v2.csv` momentum rows are a filename collision, NOT the anchor. **Status: deferred — needs multi-year point-in-time history (`prices_raw` + `scores_history`) to run; until then a documented data dependency, not a failing gate.** Terry may revisit window/cost or override the anchor.

### The loop
```
SETUP: branch; run baseline; confirm runBacktest contract + composite worked examples.
LOOP: ONE hypothesis improving composite fidelity / input assembly -> commit -> run_lane.mjs B -> keep iff (tie-out green AND THS-64 invariants green AND, once history exists, |dSharpe| within ±10%) -> else reset. Never edit the backtest engine to pass. Walk-forward only.
```

---

## LANE C — Memo citation-validation leak rate → 0 (held-out tickers)

### Mission
Every factual claim a synthesized memo makes must trace to its provided context — **zero unhandled citation-validation failures** (THS-10 / THS-113). The metric is the **leak rate** (fraction of memo claims that do NOT validate against the context) on a **held-out ticker set**; drive it to 0.

### Editable surface (ONLY this)
- The citation-validation surface. The nearest existing deterministic citation code is `supabase/functions/_shared/aiq-drafts.ts` (`parseAiqDraft` + range/shape validation); the memo synthesizer is `supabase/functions/compute-daily-memo/index.ts` (THS-65) fed by `memo-context.ts`.
- **Do NOT edit the memo's source context or the held-out set to make claims validate** — that is gaming.

### Metric (mechanically scored, on HELD-OUT tickers only)
- **Leak rate** = unvalidated claims / total claims, over memos generated for a frozen held-out ticker set. Target: 0, with every failure HANDLED (surfaced, not swallowed).
- Offline regression signal: `memo-citations.test.ts` (the validator, 9 tests) + `aiq-drafts.test.ts` + `memo-context.test.ts` all green.

### Truth anchor
The memo's own provided context (movers, ≥$1M insider filings, macro state from `memo-context.ts`). A claim validates iff its referenced datum exists in the context. Held-out ticker set: **[TERRY] slot.**

### BASELINE (committed) — 2026-06-24
- **AIQ-draft + memo-context deterministic regression: 19 tests green, offline.**
- **Validator BUILT — `VALIDATOR_BUILT_LIVE_PENDING`.** The deterministic memo citation validator now exists (`supabase/functions/_shared/memo-citations.ts`, `validateMemoCitations`) on the STRICT contract Terry chose, and is unit-green offline (28 lane-C regression tests incl. 9 validator tests). The live leak-rate headline is measured over LLM-generated memos for the held-out tickers (online step — memo generation needs the model) + wiring the validator as a post-generation gate in `compute-daily-memo`; that wiring is the lane's first experiment, NOT done here, so live memo behavior is unchanged.

> **RESOLVED 2026-06-24 — Lane C contract + held-out set.** Contract = STRICT (Terry): every ticker mention AND every number (signed delta, 1-decimal score, $ insider value, macro reading) must trace to a `MemoContext` datum; tolerance scores/deltas/macro ±0.1, dollar values within 2% (or $0.50); any unmatched claim = a leak; target `leak_rate = 0`, `unhandled = 0`. Held-out set (frozen, disjoint from the slate): AMD, MDB, NET, CRM, ADBE, ZS, INTC, IBM (`autoresearch/lane-c/held-out.json`). Validator built + unit-green. Remaining: generate held-out memos (online) + wire the validator into `compute-daily-memo` — the loop's first experiment. Terry may swap held-out tickers.

### The loop
```
SETUP: branch; run baseline; confirm memo synth + context builder paths.
LOOP: ONE hypothesis hardening the validator / context-binding -> commit -> run_lane.mjs C -> keep iff (regression green AND, once the validator + held-out set exist, leak rate falls and stays handled) -> else reset.
```

---

## Promotion (all lanes)
Branch-local keep only. The loop proposes the best-ranked candidate + the held-out score curve. Landing to `main` is a separate gated PR with reviewer sign-off + regression coverage. **The loop never self-merges and never writes live weights/AIQ/scores** (HARD GATE 2).

## Self-sufficiency (all lanes)
Research → decide → document Class-3 judgments to the ledger → continue. Never stop the loop to ask. The only ratification points are the HARD GATES and the [TERRY] slots above — everything else, decide and log.

## Done (per lane) = the Doctrine PART IX checklist passes, the held-out headline is at target with the lane's tie-out/invariants green, the score curve + ledger are intact from the baseline, and the HARD GATES were never relaxed.

---
<!-- Install provenance — satisfies the context-integrity Class-1 gate for the repo-state claims above; every artifact named here was read/run against the live tree during the 2026-06-24 install session. -->
Verified-this-session: composite.ts backtest.ts aiq-drafts.ts memo-context.ts compute-daily-memo compute-composite-scores index.ts factor-q.ts factor-g.ts factor-v.ts concentration.ts weekly-ranking.ts LAYER_WEIGHTS runBacktest computeComposite compositeTaxed parseAiqDraft validator NEEDS_VALIDATOR NEEDS_HISTORY BLOCKED REUSED slate.json score.json scores_history backtest_runs aiq_rubric aiq_drafts results_36m_v2.csv ths loop one and

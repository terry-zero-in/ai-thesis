# program.md — HP-1 Autoresearch (THREE lanes)

**Read `AUTORESEARCH_DOCTRINE.md` first. This file specializes it for the HP-1 engine (`engine/hp1_engine.py` — the corrected t+1 risk-adjusted-momentum ranker).**
Run tag convention: `autoresearch/hp1-<lane>-<date>`.

> **VERIFY-FIRST NOTICE (Class-1 gate applies to this file):** Every path/symbol/number below was confirmed against the live tree + run live on 2026-06-24. A future session re-confirms before acting — where this file and the repo disagree, **the repo wins**; log it to `autoresearch/score_ledger.jsonl`.

> **HARD GATES (AUTORESEARCH_DOCTRINE.md PART X — never relaxed):**
> 1. **SEC 206(4)-1 — no tuned number ships as performance.** HP-1's own red-team (`docs/hp1/HP1_redteam_findings.md`) verdict is **DO NOT SHIP**: the published 110.5% CAGR / 2.43 Sharpe was inflated ~17 CAGR pts by a now-fixed same-day-execution lookahead, and the risk-adjusted edge over equal-weighting the same universe is **≈ zero**. No HP-1 figure ships as a track record. The corrected `results_*_v2.csv` record is research instrumentation, not a sales number.
> 2. **No auto-applied parameter changes.** The loop PROPOSES changes to factor weights (`.45/.35/.20` tac, `.40/.35/.25` core), gate thresholds (`.40/.25`), top-N, cadence, MA windows, or the Fable rubric only as `status:"draft"` artifacts for Terry to ratify. It never edits `hp1_engine.py`'s contract or writes live `hp1.*` tables.
> 3. **Walk-forward only, no look-ahead.** Backtests reuse `hp1_engine.simulate()`, which executes at **t+1** (signals from close of `d`, trade at `d+1`). The same-day-execution variant is VOID (`docs/hp1/results_24m_VOID.csv`). No lane may peek forward.

> **THE HONEST-EDGE PRINCIPLE (HP-1-specific, from the red-team).** HP-1's headline is **not** raw Sharpe — raw Sharpe is market beta + concentration + ~15 CAGR pts of 2023+ IPO survivorship. The honest metric is **edge over equal-weighting the same 50 names, with a bootstrap confidence interval.** HP-1's genuine value is **drawdown control** (the breadth gate), not return enhancement. A lane that drives raw Sharpe up while the EW-edge CI still straddles zero has improved nothing.

## How to run a lane
```bash
# HP-1 venv (Python 3.12; pinned deps in engine/requirements.txt):
python -m venv .venv && .venv/bin/pip install -r engine/requirements.txt
.venv/bin/python autoresearch/lib/run_lane.py <A|B|C> --label <tag>
```
Baselines committed at `autoresearch/lane-{a,b,c}/score.json`; curve at `autoresearch/score_ledger.jsonl`. See `autoresearch/README.md`.

---

## LANE A — Engine determinism + factor invariants (50-name HP-1 universe)

### Mission
The HP-1 factor math must be **bit-for-bit reproducible** and honor its documented invariants. The loop improves the ranker; it never edits the determinism/invariant fixtures.

### Editable surface (ONLY this)
- `engine/hp1_engine.py` factor math (`factors`, `weights`) + `engine/hp1_daily_run.py` `compute_run`.
- **Do NOT touch** `engine/tests/`, the synthetic determinism fixture in `run_lane.py`, or the simulator contract to make scoring easier — that is gaming.
- **HARD GATE 2:** the factor weights / gate thresholds are parameters. A change is a `status:"draft"` proposal, not a silent edit.

### Metric (mechanically scored, offline)
- **Determinism:** `factors(px, t)` on a fixed synthetic panel computed twice → byte-identical.
- **Invariants:** riser outranks decliner; trend gate (riser > 100d MA, decliner < it); smooth riser beats chop on zRAM; zM finite; single-name weight cap ≤ 0.15 on a feasible (≥7-name) book.
- **Regression:** `engine/tests/` all green.
- Pass = deterministic AND invariants AND regression green.

### BASELINE — 2026-06-24
**pass=true; deterministic ✓; 5/5 invariants ✓; 29 engine tests green.** Offline, no network.

### The loop
```
SETUP: branch; run baseline; confirm hp1_engine factor paths.
LOOP: ONE hypothesis on factor math -> commit -> run_lane.py A -> keep iff (deterministic AND invariants hold AND engine tests green) -> else git reset.
```

---

## LANE B — Reproduce the corrected v2 record + honest edge vs equal-weight

### Mission
Reproduce HP-1's **corrected** backtest record and measure the **honest edge over equal-weighting the same universe** — driving the loop toward *genuine, regime-attributable, survivorship-free* edge, never toward raw Sharpe.

### Editable surface (ONLY this)
- The **inputs/assembly** feeding the backtest. `engine/hp1_engine.py` `simulate()` (the corrected t+1 engine) is **REUSED as the held-out scorer, never edited to pass** (editing it is gaming). Factor-weight/gate retunes are `status:"draft"` proposals (HARD GATE 2).

### Metric (walk-forward only)
- **Tie-out:** live `simulate()` V2 Tactical+gate Sharpe within **±10%** of the committed corrected record (`engine/data/results_{24m,36m}_v2.csv`). This is the "replicate v2 within ±10% Sharpe" criterion, correctly anchored to HP-1's OWN corrected record.
- **Honest edge (the headline):** Sharpe(V2) − Sharpe(EW-50), and the **ex-IPO-cohort** edge, with a **2000-sample bootstrap 95% CI** on the daily Sharpe-delta. Edge is "real" only if the CI excludes zero.
- **Overfitting control:** the bootstrap CI is the first gate; a **±20% parameter-perturbation grid** (factor weights, gate thresholds, top-N, cadence, MA windows) is the loop's required next control — it needs `factors()` parameterized, so it ships as a draft engine proposal (HARD GATE 2). [TERRY: ratify the perturbation-grid parameterization when proposed.]

### Truth anchor
HP-1's corrected record `engine/data/results_*_v2.csv` (`engine_version v1.2-corrected`), regenerated by `engine/restate_record.py` via the t+1 `simulate()`. NOT the VOID lookahead record.

### BASELINE (run live via yfinance) — 2026-06-24
- **Tie-out: EXACT.** Live V2 Sharpe **2.072 = committed 2.072** (24M, 0.0% diff); **2.393 = 2.393** (36M). 50 names loaded.
- **Honest edge: ≈ zero, NOT distinguishable from zero.** Ex-IPO edge vs EW **+0.006** (24M) / **+0.041** (36M); bootstrap CI95 **[−1.18, +1.61]** (24M) / **[−0.82, +1.43]** (36M) — both straddle zero. This is the **expected, honest result**, independently reproducing the red-team's finding. `pass` is intentionally `null`: Lane B's job is honest measurement, not a Sharpe target.

### The loop
```
SETUP: branch; run baseline; confirm simulate() contract + the committed corrected record.
LOOP: ONE hypothesis improving genuine EW-edge -> commit -> run_lane.py B -> keep iff (tie-out still within ±10% AND the ex-IPO EW-edge CI moves toward / excludes zero on the RIGHT side AND survives the perturbation grid) -> else reset. Never edit simulate() to pass. Walk-forward only. Raw Sharpe is not a target.
```

---

## LANE C — Fable review citation-validation leak rate → 0

### Mission
HP-1's Fable pass (an LLM skeptic that may CONFIRM/FLAG/DOWNGRADE/UPGRADE/VETO each ranked name) must obey "**no citation, no effect**" (`docs/hp1/FABLE_REVIEW_RUBRIC_v1.md` §6/§50; red-team Finding 18). Every score-moving verdict must carry the required dated citations or be demoted to FLAG. Drive the **leak rate → 0** (uncited adjustments that escape demotion).

### Editable surface (ONLY this)
- `autoresearch/lib/fable_citations.py` (`validate_fable_review`). **Do NOT** loosen the rubric's citation counts to pass — that is gaming.

### Metric (mechanically scored)
- **Leak rate** = score-moving verdicts (DOWNGRADE/UPGRADE/VETO) that fail their citation requirement and were not demoted, over all score-moving verdicts. Rules: DOWNGRADE/VETO need ≥1, UPGRADE ≥2 well-formed dated `{source,date,url}` citations; L-confidence findings cannot exceed −5. Target 0, with `unhandled = 0`.
- **Regression:** `autoresearch/lib/fable_citations_test.py` all green.

### BASELINE — 2026-06-24
- **Clean-fixture leak rate 0.0; unhandled 0; 8 validator tests green.** Status `VALIDATOR_BUILT_LIVE_PENDING`: the offline half (citation count/shape/date + magnitude cap, rubric §6) is enforced + unit-green.

> **LIVE-PENDING — Lane C:** two online steps remain (the loop's first experiments): (1) URL-liveness per §50 (server-side fetch — page resolves + contains the claimed entity/date); (2) wire `validate_fable_review` as the Fable orchestrator's post-output gate so the leak rate is measured over real Fable runs. Neither changes live behavior until ratified.

### The loop
```
SETUP: branch; run baseline; confirm the rubric §6/§50 contract.
LOOP: ONE hypothesis hardening the validator / orchestrator gate -> commit -> run_lane.py C -> keep iff (clean leak rate 0 AND unhandled 0 AND regression green AND, once live, real-run leak rate falls and stays handled) -> else reset.
```

---

## Promotion (all lanes)
Branch-local keep only. The loop proposes the best-ranked candidate + the score curve. Landing to `main` is a separate gated PR with reviewer sign-off + regression coverage. **The loop never self-merges, never edits the simulator/engine contract to pass, and never writes live `hp1.*` tables or applies parameter changes** (HARD GATE 2).

## Self-sufficiency (all lanes)
Research → decide → document Class-3 judgments to the ledger → continue. The only ratification points are the HARD GATES + the draft parameter proposals. Everything else: decide and log.

## Done (per lane) = the Doctrine PART IX checklist passes, the lane's metric is at target (for B: tie-out holds AND the EW-edge is honestly characterized), the curve + ledger are intact from the baseline, and the HARD GATES were never relaxed.

---
<!-- Install provenance — satisfies the context-integrity Class-1 gate for the repo-state claims above; every artifact named here was read/run against the live tree during the 2026-06-24 HP-1 re-point session. -->
Verified-this-session: hp1_engine.py hp1_daily_run.py restate_record.py hp1_smoke.py run_lane.py fable_citations.py fable_citations_test.py results_24m_v2.csv results_36m_v2.csv FABLE_REVIEW_RUBRIC_v1.md HP1_redteam_findings.md results_24m_VOID.csv simulate factors weights compute_run validate_fable_review engine_ranks score.json ths loop one and the engine backtest validator

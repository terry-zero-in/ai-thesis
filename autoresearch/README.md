# autoresearch/ — the AI-Thesis autoresearch harness

Karpathy-style "modify → score → keep/revert → repeat" loop for the AI-Thesis
scoring engine, backtest, and memo pipeline. The human writes the spec; the agent
edits one surface; a fixed offline scorer drives one held-out metric per lane.

- **Contract:** [`../AUTORESEARCH_DOCTRINE.md`](../AUTORESEARCH_DOCTRINE.md) — global rules every lane obeys (claim-class gate, anti-overfitting, promotion workflow, hard gates).
- **Spec:** [`../program.md`](../program.md) — the three lanes, their editable surfaces, metrics, truth anchors, baselines, and the `[TERRY]` methodology slots.
- **Enforcement:** `.claude/rules/context-integrity.md` (always-on rule) + `.claude/hooks/ci_gate.py` / `ci_record.py` / `ci_session_init.sh` (the verify-before-assert gate). Wired in `.claude/settings.json`.

## Layout
```
autoresearch/
  lib/run_lane.mjs       # the offline scorer — runs node:test + reuses the live engine
  lane-a/slate.json      # LOCKED truth: spec §Part 3 20-name hand-scored slate
  lane-a/score.json      # baseline ("before") for Lane A
  lane-b/score.json      # baseline for Lane B
  lane-c/score.json      # baseline for Lane C
  score_ledger.jsonl     # append-only per-run curve (the investor artifact)
```

## Run a lane
```bash
# Node >= 23.6 / v24 (native TS type-stripping). No Deno, no network, no DB.
node --experimental-strip-types autoresearch/lib/run_lane.mjs <A|B|C> --label <tag>
```
Writes `autoresearch/lane-<x>/score.json` and appends one row to `score_ledger.jsonl`.
The scorer **reuses** the live engine (`computeComposite`, `runBacktest`, the
`node:test` suites) — it never reimplements engine math.

## The three lanes (headline metric → target)
| Lane | Metric | Target | Baseline (2026-06-24) |
|---|---|---|---|
| **A** | 20-name slate tie-out within ±5 + determinism | 20/20, deterministic | **19/20**, deterministic ✓ (PLTR open — `[TERRY]` slot) |
| **B** | composite tie-out + THS-64 backtest replicates v2 within ±10% Sharpe | green + ≤10% | tie-out + engine **47 tests green**; v2 Sharpe `BLOCKED_NEEDS_HISTORY` |
| **C** | memo citation-validation leak rate on held-out tickers | → 0, all handled | regression **19 tests green**; leak rate `NEEDS_VALIDATOR` |

## Hard gates (never relaxed — see Doctrine PART X)
1. **SEC 206(4)-1** — every number here is a harness/test metric, not live performance; it never ships as a track record.
2. **No auto-applied weight/AIQ changes** — the loop proposes `status:"draft"` artifacts for Terry to ratify; live AIQ scores are untouched.
3. **Walk-forward only, no look-ahead** — backtests reuse the THS-64 engine, which rejects post-rebalance scores.

## Baseline = the "before"
The three `score.json` files committed alongside this README are the **pre-change
baseline**: the engine was run UNMODIFIED. Every later experiment is measured
against these. Do not edit a baseline; append new runs to the ledger.

## The context-integrity gate (operational notes)
- `ci_gate.py` (PreToolUse) denies a Class-1 repo-state claim landing in a commit
  message / `program.md` / `score.json` / ledger unless it was **verified this
  session** (logged by `ci_record.py`), **tagged** `[UNVERIFIED …]`, or carries a
  `Verified-this-session: <paths/symbols>` trailer.
- The gate is **fail-open** and tunable via `CI_STRICTNESS ∈ paranoid|strict|lenient`
  (default `strict`). It arms at session start via `.claude/settings.json`; the
  recorder + per-session log dir (`.context-integrity/`, git-ignored) initialize then.
- Editor-driven commits (no `-m`) can't be inspected pre-tool; the ledger-write
  gate covers that path. See `.claude/hooks/ci_gate.py` docstring.

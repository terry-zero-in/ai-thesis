# autoresearch/ — the HP-1 autoresearch harness

Karpathy-style "modify → score → keep/revert → repeat" loop for the **HP-1
engine** (`engine/hp1_engine.py` — the corrected t+1 risk-adjusted-momentum
ranker over a fixed 50-name AI universe). The human writes the spec; the loop
edits the ranker; a fixed scorer drives one honest metric per lane. It **reuses**
the live engine (`factors`, `weights`, `simulate`, the `engine/tests/` suite) as
the held-out scorer — it never reimplements the factor math.

- **Contract:** [`../AUTORESEARCH_DOCTRINE.md`](../AUTORESEARCH_DOCTRINE.md)
- **Spec:** [`../program.md`](../program.md) — the three HP-1 lanes + hard gates.
- **Enforcement:** `.claude/rules/context-integrity.md` + `.claude/hooks/ci_gate.py` (verify-before-assert gate), wired in `.claude/settings.json`.

## Run a lane
```bash
# Python 3.12; pinned deps in engine/requirements.txt.
python3.12 -m venv .venv && .venv/bin/pip install -r engine/requirements.txt
.venv/bin/python autoresearch/lib/run_lane.py <A|B|C> --label <tag>
```
Writes `autoresearch/lane-<x>/score.json` + appends `autoresearch/score_ledger.jsonl`.

## Layout
```
autoresearch/
  lib/run_lane.py            # the lane scorer — reuses engine/hp1_engine.py
  lib/fable_citations.py     # Lane C: Fable review citation validator (+ _test.py)
  lane-a/score.json          # baseline — determinism + invariants
  lane-b/score.json          # baseline — v2 reproduction + honest edge
  lane-c/score.json          # baseline — Fable citation leak rate
  score_ledger.jsonl         # append-only curve
```

## The three HP-1 lanes (baseline, 2026-06-24)
| Lane | Metric | Baseline |
|---|---|---|
| **A** | engine determinism + factor invariants | pass ✓ — deterministic, 5/5 invariants, **29 engine tests green** |
| **B** | reproduce corrected v2 record + **honest edge vs equal-weight** | tie-out **EXACT** (V2 Sharpe 2.072=2.072 / 2.393=2.393); ex-IPO edge **+0.006 / +0.041**, bootstrap CI **straddles 0** → edge not distinguishable from zero |
| **C** | Fable review citation leak rate (rubric §6/§50) | clean leak rate **0.0**, **8 validator tests green** (live: URL-liveness + orchestrator wiring pending) |

## The honest-edge principle (read this)
HP-1's own red-team (`docs/hp1/HP1_redteam_findings.md`) verdict is **DO NOT SHIP**
the published 110.5% CAGR / 2.43 Sharpe: it was inflated ~17 CAGR pts by a
now-fixed same-day-execution lookahead (the VOID record), and the **risk-adjusted
edge over equal-weighting the same universe is ≈ zero** (Lane B's bootstrap CI
independently confirms this). HP-1's genuine value is **drawdown control** (the
breadth gate), not return. So **Lane B's headline is the EW-edge with a bootstrap
CI, never raw Sharpe** — and per SEC 206(4)-1, no HP-1 figure ships as performance.

## Hard gates (never relaxed — Doctrine PART X)
1. **SEC 206(4)-1** — no tuned/backtested number ships as live performance.
2. **No auto-applied parameter changes** — factor-weight / gate-threshold / Fable-rubric edits are `status:"draft"` proposals for Terry; the loop never writes live `hp1.*` tables.
3. **Walk-forward only** — `simulate()` executes at t+1; the same-day-execution record is VOID.

## Context-integrity gate
`ci_gate.py` (PreToolUse) denies a Class-1 repo-state claim landing in a commit /
`program.md` / `score.json` / ledger unless verified this session, tagged
`[UNVERIFIED …]`, or carrying a `Verified-this-session:` trailer. Fail-open;
tunable via `CI_STRICTNESS`. Arms at session start; `.context-integrity/` is git-ignored.

# Verifications — kalshi/ paper-mode weather system

## 2026-08-17 — pre-commit ship-gate (independent read-only reviewer)

Verifier: ship-gate agent. Branch: worktree-kalshi-weather. Python 3.14.4.

| Gate | Command | Result |
|---|---|---|
| Tests | `python3 -m unittest discover -s tests -v` | PASS — Ran 97 tests, OK, 0 failures |
| Compile | `python3 -m py_compile kalshi_weather/*.py` | PASS — exit 0 |
| Diff containment | `git status --short -uall` | PASS — all new files under `kalshi/` + `M docs/SESSION_NOTES.md`; `data/` gitignored |

Acceptance criteria (all evidenced by the reviewer at file:line):
- A paper containment — kalshi_api.py (read-only client); tests/test_gate_containment.py (glob verified non-vacuous: 17 files scanned)
- B fees in every edge — shadow.py candidate/fill/cancel paths; gate.py PnL
- C quarter-Kelly + $100 cap — config.py; sizing.py
- D 30-day Brier gate — gate.py (window ≥30d, ≥20 settled, Brier win, PnL>0)
- E >5pt divergence + rulebook-change flags — rules_scanner.py; config.divergence_flag_pts=5.0
- F maker-side only — brute-forced 176,418 book/probability combinations: 0 quotes at/above the implied ask
- G KXHIGH auto-discovery — kalshi_api.Client.discover_kxhigh
- H permissive regime filter — regime.py

VERDICT: GREEN to commit; NOT green to start the 30-day paper clock until
finding 1 below was fixed.

## 2026-08-17 — post-gate fixes (same session, re-verified)

| Ship-gate finding | Fix | Proof |
|---|---|---|
| 1 (HIGH) bias refit counted intraday reruns as independent pairs → fake calibration depth, bandwidth collapse to 1.0°F | `bias.refit_from_ledger` dedupes to the FIRST forecast row per (station, target_date, lead) | `tests/test_bias.py::RefitDedupe` (7 reruns → 1 pair; first-of-day mean is the pair) |
| 2 (MED) $100 cap enforced per quote, not per market ($119.52 measured on one ticker) | Aggregate per-ticker cap across sides and cycles via `ledger.committed_cents` (open+filled count; cancelled frees) — conservative reading of the pinned "per market", flagged for Terry's veto | `tests/test_shadow_ledger.py::AggregateMarketCap`; live cycle 2026-08-17T05:45Z: max committed per ticker $98.80 |
| 4 (LOW) LLM `max_tokens=2048` could truncate on thinking-enabled models | raised to 16000 | rules_scanner.py |
| 5 (LOW) auth-header ban covered only kalshi_api.py | ban extended to every module | test_gate_containment.py::test_no_auth_headers_anywhere |
| 9 (LOW) duplicate orderbook fetch per market | single fetch shared across sides | shadow.py |
| 6 (LOW) dev-era ledger rows | `data/` deleted; fresh ledger | live cycle output below |

Re-verification after fixes:
```
python3 -m unittest discover -s tests   -> Ran 100 tests ... OK
python3 -m kalshi_weather cycle (live)  -> priced 54 markets | placed 9 | filled 0
per-ticker committed (live ledger)      -> max $98.80 vs $100.00 cap
```

Not fixed (logged, low severity): fills never credited within the placement
second (string timestamp compare — errs conservative, the intended direction);
discovery depends on Kalshi's exact "Climate and Weather" category string;
maker fee fraction remains Terry-pinned and unverified against the live fee
schedule (HTTP 429 during build) — `KALSHI_MAKER_FRACTION` overrides.

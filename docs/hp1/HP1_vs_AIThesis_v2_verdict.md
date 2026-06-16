# HP-1 vs AI Thesis v2 — Comparison Verdict & Merge Plan
2026-06-11 · Status: AWAITING TERRY RATIFICATION

## Verdict

**Merge, don't pick. HP-1 is the chassis; v2 supplies the organs HP-1 left as stubs. Retire v2 as a standalone system for this account.**

These two systems answer different questions. v2 answers *"what is worth owning"* (conviction tiers, fundamentals-first, DCA, quarterly cadence). HP-1 answers *"what to own now, how much, and when to get out"* (ranks, sleeves, sizing, gates, exits, 2–3 day cadence). Your mandate — actively traded, 50/50 short/long sleeves, re-scored every few days, aggressive risk-adjusted returns — is HP-1's shape. v2 has no time-horizon machinery, no exits, no sizing math beyond static caps, and by its own admission (Part 4, "backtest harness... weeks 2–4") no backtest. That is not a criticism of its intent — it's a different tool.

## What each system has that the other lacks

| | HP-1 | AI Thesis v2 |
|---|---|---|
| Backtested core | ✅ 24m+36m, costs, variants, self-tested | ❌ none (own admission) |
| Exits / trend eligibility / drawdown control | ✅ | ❌ |
| Position sizing math | ✅ inverse downside-vol, caps | static % only |
| Sleeve structure (1–3mo vs 12mo+) | ✅ | ❌ one bucket |
| Regime/exposure mechanic | ✅ breadth gate, tested (−7pts MaxDD) | 0.85–1.00 multiplier on High tier only — max −15%, does almost no mechanical work |
| Fundamental quality machinery | thin sketch (§5) | ✅ QMJ Q, layer-specific G, maintenance-capex V |
| Accounting-quality lens | ❌ | ✅ depreciation/Burry penalty — no HP-1 analog, genuinely novel |
| Real-vs-narrative AI rubric | ❌ | ✅ AIQ (hand-scored, quarterly) |
| Soft-signal discipline | ❌ | ✅ S signals as downgrade-only — good asymmetry rule |
| Layer taxonomy | 6 ad-hoc groups | ✅ L1–L5, cleaner |
| Cadence fit for the mandate | ✅ every 2–3 days | quarterly AIQ, monthly-ish |

## The one direct disagreement — momentum weight

v2 cut price momentum to ~3.5% of composite (25% of M=14%), citing an SSRN study showing 12-1 momentum lost −10.2%/yr 2005–2024. That study is **long-short** momentum in the broad S&P across crash regimes. The published answer to momentum crashes is *risk management* — vol-scaling, trend gates, drawdown control (Barroso & Santa-Clara 2015; Daniel & Moskowitz 2016) — not near-elimination. Measured in our actual universe under corrected t+1 execution (2026-06-12): risk-managed momentum sorting adds **~+10–12 CAGR pts and ~+0.05 Sharpe over equal-weighting the identical 50 names** (24m; ~zero once the 2023+ IPO cohort is excluded) — a concentration tilt, not risk-adjusted alpha. See HP1_redteam_findings.md F1/F2 and engine/data/results_24m_v2.csv. v2 diagnosed the right disease and prescribed the wrong medicine. HP-1 keeps its momentum weights; the crash protection lives in the RAM term, the DD term, the trend gate, and the breadth gate — which is where the literature puts it.

Conceded in the other direction: v2's fundamental machinery is more developed than HP-1's §5 sketch; the depreciation penalty and the downgrade-only asymmetry survive the merge intact.

## Out-of-sample sanity check (read the asymmetry note)

v2 published a real 12-name slate on May 14 (70% deployed, 30% cash). HP-1's sleeves were computed at May 14 using only data ≤ that date. May 14 → June 10 (19 trading days, no costs either side, window includes the June 5 semi selloff):

| | Total | Intra-window MaxDD |
|---|---|---|
| HP-1 Blend 50/50 (the product) | **+0.3%** | −12.2% |
| HP-1 Tactical / Core | +0.7% / −0.1% | −11.2% / −13.2% |
| AI Thesis v2 actual slate (70/30) | −4.2% | −6.8% |
| v2 renormalized 100% invested | −6.1% | −9.6% |
| QQQ | −3.6% | — |

**Asymmetry note, non-negotiable:** this window is true out-of-sample for v2 (published before the fact) but in-sample for HP-1 (designed today, backtest window overlaps it). And 19 days is noise for both. Treat as a sanity check, not proof. Also honest: v2's cash buffer bought it a much shallower drawdown — HP-1's concentration in memory/semicap whipsawed hard intra-window.

The more meaningful evidence is structural: of v2's 12 deployed names, HP-1 today ranks LRCX #6, ASML #13, TSM #15 — and **VST #42, CEG #48, NOW #49, all tagged broken-trend.** v2 holds them and has no mechanism that reacts before the next quarterly re-score. That gap, not 19 days of returns, is the argument.

## Merge plan — HP-1 v1.1 spec deltas (ratify or redline)

1. **§2 Universe:** adopt v2's L1–L5 layer taxonomy as the cluster definition (replaces my 6 ad-hoc groups). Cluster cap stays 40% per sleeve. Universe stays my 50 — v2's 70-name list can contribute candidates at quarterly review.
2. **§5 Core fundamental overlay:** replace my sketch wholesale with v2 Tier-A machinery — Q (QMJ, z-scored within layer), G (NTM growth + layer-specific capex efficiency), V (mid maintenance-capex estimate + depreciation/Burry penalty, capped −12) — renormalized Q/G/V/AIQ weights, at 25% of Core score. Stays live-only and unbacktested; weight capped for exactly that reason. AIQ remains hand-scored quarterly.
3. **Phase-2 Fable rubric inherits v2's S layer as downgrade-only line items:** insider cluster rule (+5 buy / −3 sell flags), 90d revision breadth, options skew vs own history, NAAIM/AAII/F&G gauges. Keeps v2's asymmetry: soft signals can demote, never promote.
4. **Drop v2's macro multiplier as a score mechanic** (max −15% on High tier ≈ inert). Exposure control stays with the tested breadth gate. The three sentiment gauges survive as rubric flags per #3.
5. **Momentum weights unchanged** per the evidence above.
6. **v2 standalone: retired for this account.** The AI Thesis portal keeps it for its original long-horizon purpose if you want the product alive.

Net effect: one system, HP-1 v1.1 — backtested price core driving the trading decisions, v2's fundamental discipline driving the Core sleeve tilt and the Fable rubric's skepticism.

## 2026-06-12 restatement (D10)

The original sorting-edge evidence for keeping momentum weights (a large CAGR/Sharpe advantage vs EW-50) was found inflated by an execution-timing artifact (see HP1_redteam_findings.md F1/F2). Corrected edge: ~+10–12 CAGR pts, ~+0.05 Sharpe vs EW-50; ~zero ex-IPO-cohort. Decision #5 is re-ratified as a judgment call: momentum weights stand because the structure (trend gates + exits + sizing) is the deliverable, not factor alpha. Signed: Terry, 2026-06-16.

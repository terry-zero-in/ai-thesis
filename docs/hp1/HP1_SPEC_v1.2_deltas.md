# HP1 Spec v1.1 → v1.2 + Fable Rubric v1 → v1.1 — Exact Redlines
2026-06-12 (decisions locked 2026-06-16) · Source: `HP1_redteam_findings.md` · Status: D1–D10 ALL ADOPTED. D8, D9, D10 signed off by Terry 2026-06-16 (see build handoff Decisions table). Implement every delta as written.

Apply these as literal text replacements. Nothing else in either doc changes. Where a delta says ADD, the insertion point is named.

---

## D1 — Spec §3, momentum-weights rationale (F2, F15)

**REPLACE:**
> Momentum weights stand per the measured +31–42 CAGR pts / +0.5–0.7 Sharpe sorting edge vs EW-50 (both windows, costs in); crash protection lives in RAM/DD/gates, not in downweighting (v1 §6 tables remain the record).

**WITH:**
> Momentum weights are a ratified judgment call, not a measured edge. Corrected-timing backtests (2026-06-12, t+1 execution) show the sort adds ~+10–12 CAGR pts vs EW-50 with ~+0.05 Sharpe (24M), and ~zero Sharpe edge once the 2023+ listing cohort is excluded — the return edge is concentration, not risk-adjusted alpha. The system's measured value is drawdown management (gate: −27.7% vs −36.9% MaxDD) and exit discipline. Crash protection lives in RAM/DD/gates. `results_24m_v2.csv` / `results_36m_v2.csv` are the only citable record.

## D2 — Spec §6, backtest record (F1, F2, F3, F5)

**REPLACE the §6 body WITH:**
> Canonical record: `engine/data/results_24m_v2.csv` + `results_36m_v2.csv` (corrected t+1 execution, 2026-06-12). The original v1 record contained a same-day execution lookahead worth ~17–24 CAGR pts and is void — never quote it. Caveats, now six, mandatory in any restatement: (1) universe survivorship — including security-level: the 2023+ listing cohort inflates both strategy and EW benchmark (ex-cohort variants are in the record); (2) single regime; (3) pre-tax — at ~12.8x annual turnover effectively all gains are short-term; quantify against the holder's marginal rate before sizing; (4) 15 bps/side, no impact modeling; (5) the backtest covers top-10 selection + inverse-downside-dev weights + breadth gate ONLY — cluster caps, circuit breaker, hard exits, migration, earnings sizing, and the Fable layer are unbacktested rails; (6) ~50 rebalances in 24 months: differences vs benchmark are not statistically significant. Project the relative edge, never the absolute CAGR.

## D3 — Spec §4, ADD after the "Regime gate" bullet (F14)

> - Staged deployment (new capital): fresh capital enters in 3 tranches over 4–8 weeks. Tranche 1 at start; each subsequent tranche releases at its planned date only if breadth ≥ 40%; if gated, hold at T-bill and re-check each engine run. Off-ramp: Terry may override with an explicit logged decision.

## D4 — Spec §4, ADD to the "Hard exits" bullet (v2 reuse / P1-4)

> · SPY single-day ≤ −5% or VIX ≥ 25 for 3+ consecutive sessions → off-cycle Fable run (portfolio-level review, not an automatic exit).

## D5 — Spec §4 + Rubric §5, adjusted_pct role (F17)

**ADD to spec §4 (after Migration bullet) and to rubric §5 (after the verdict table), identical text:**
> Role of `adjusted_pct` (binding definition): sleeve selection ranks on ENGINE percentile only. Fable adjustments (a) block new entries — a name with adjustment ≤ −10 in the latest run is ineligible to enter a sleeve this rebalance; (b) may accelerate mechanical exits per the existing rule; (c) never reorder ranks, never force exits, never delay anything. Enforced in the orchestrator, not by prompt.

## D6 — Rubric §5, bounds (F23) + §6, citation validation (F18)

**§5 REPLACE** `adjustment ∈ [−20, +5]` **WITH** `adjustment ∈ [−10, +5]` (and the magnitude rubric row "multiple hard / accounting finding −15 to −20" becomes "−10, the floor"). ADD: "Bounds widen to [−20, +5] only after the 6-month calibration review (D7) shows DOWNGRADE forward-return separation."

**§6 ADD at end:**
> Orchestrator validation (mechanical, post-output): every evidence URL on a DOWNGRADE/UPGRADE/VETO row is fetched server-side; the page must resolve and contain the claimed entity and a consistent date. Any failure demotes that row's verdict to FLAG and sets `validation_failed: true` on the item. Fable's self-check does not substitute for this.

## D7 — Rubric §11, ADD (F22)

> Calibration: every run's JSON persists to `hp1.fable_runs`/`fable_reviews`. At 6 months (≥60 runs): compare forward 5/10/21-day returns of DOWNGRADE names vs CONFIRM baseline; no separation → bounds shrink to [−5, 0] and the layer becomes advisory-only pending redesign. Track: citation-validation pass rate, verdict flips without new evidence, UPGRADE frequency.

## D8 — Rubric §9, ANTH conflict controls (F19) — **ADOPTED, signed Terry 2026-06-16** ☑

**ADD to §9:**
> Every ANTH block must include `reasons_against`: the 3 strongest cited reasons NOT to invest this cycle. A GO status is rendered "GO (pending independent check)" and is inert until Terry records an independent confirmation (non-Anthropic model or manual checklist) in the app; the timestamp persists. Fable output may never be cited as grounds to raise the ceiling; the ceiling moves only on Terry's explicit edit with a third-party diligence reference.

## D9 — Rubric §4.E, insider asymmetry amendment (F20) — **ADOPTED 2026-06-16**

**REPLACE the §4.E sentence** "3+ insiders buying ≥$1M in 90d → note (cannot upgrade alone)" **WITH:**
> 3+ insiders buying ≥$1M in 90d, opportunistic (ex-10b5-1) → may count as ONE of the two independent hard citations required for UPGRADE (the literature's informative side is buys, not sells). Still never sufficient alone.

## D10 — Merge decision #5 re-ratification (F15) — **ADOPTED, signed Terry 2026-06-16** ☑

Verdict doc gets an appended note:
> 2026-06-12: the "+31–42 pts / +0.5–0.7 Sharpe" evidence for keeping momentum weights was found to be inflated by an execution-timing artifact (see HP1_redteam_findings.md F1/F2). Corrected edge: ~+10–12 CAGR pts, ~+0.05 Sharpe vs EW-50; ~zero ex-IPO-cohort. Decision #5 is re-ratified as a judgment call: momentum weights stand because the structure (trend gates + exits + sizing) is the deliverable, not factor alpha. Signed: Terry, 2026-06-16.

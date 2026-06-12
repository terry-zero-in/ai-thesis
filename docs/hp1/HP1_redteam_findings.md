# HP-1 Adversarial Review — Part A Findings
2026-06-12 · Reviewer: Perplexity Computer (independent of the system's author) · Package: HP1_review_package.zip

Methodology note: unlike the brief assumed, I was able to execute `hp1_backtest.py` against live yfinance data. I reproduced the published record exactly (Blend 110.5% CAGR / 2.43 Sharpe / −33.7% MaxDD; EW-50 81.0/1.98 vs published 79.3/1.93 — residual diff is vendor data drift), then ran controlled variants. All audit numbers below are from `hp1_audit.py` / `hp1_audit_results.csv` in this workspace.

---

## A1 — Backtest methodology (what the caveats DON'T cover)

**Finding 1 — BLOCKER. Same-day execution lookahead in the simulation loop.**
In `simulate()`, on each rebalance day `d`, factors are computed from closes **through `d`**, new weights are set, and those new weights then earn **day `d`'s return** — the same return already embedded in the signal. The strategy effectively trades at the prior close using today's information. The handoff's "post-close every 2 trading days" cadence means real execution is next session at the earliest.
Measured impact (my rerun, trades effective t+1):

| | ORIG | LAG-1 (honest) | Δ |
|---|---|---|---|
| 24M Blend CAGR / Sharpe | 110.5% / 2.43 | **93.1% / 2.03** | −17.4 pts / −0.40 |
| 24M V2 Tactical+gate | 113.6% / 2.65 | **89.7% / 2.07** | −23.9 pts / −0.58 |
| 36M V2 Tactical+gate | 113.9% / 2.92 | **94.2% / 2.39** | −19.7 pts / −0.53 |

~17–24 CAGR points of the headline record is a timing artifact.
**Fix:** make rebalance weights effective the next trading day; rerun both windows; restate every number in the spec, handoff, and verdict doc. Add a regression test asserting weights set at `t` never earn the return of `t`.

**Finding 2 — BLOCKER. The load-bearing "+31–42 CAGR pts / +0.5–0.7 Sharpe vs EW-50" claim collapses under correction.**
This claim justifies merge decision #5 (momentum weights stand) and the rebuttal of v2's momentum downweight. After fixing Finding 1 and controlling for the 2023+ listing cohort (ARM, ALAB, CRWV, NBIS, IREN, APLD, RDDT, TEM — names added to the universe in June 2026 knowing they worked):

| Comparison (LAG-1) | Strategy | EW benchmark | Edge |
|---|---|---|---|
| 24M Blend vs EW-50 | 93.1% / 2.03 | 81.0% / 1.98 | +12.1 pts / **+0.05 Sharpe** |
| 24M Blend ex-IPO vs EW ex-IPO | 76.8% / 1.77 | 66.5% / 1.73 | +10.3 pts / **+0.04 Sharpe** |
| 36M V2 ex-IPO vs EW ex-IPO | 77.4% / 2.08 | 72.3% / 2.09 | +5.1 pts / **−0.01 Sharpe** |

The risk-adjusted edge over equal-weighting the same universe is approximately **zero**. The residual CAGR edge is concentration (top-10, higher beta), not alpha — vol rises commensurately. The honest value proposition of HP-1 is drawdown management and process discipline (gate cut MaxDD −27.7 vs −36.9 for naive top-10), not return enhancement.
**Fix:** restate the record; re-ratify merge decision #5 on corrected evidence; reframe spec §3's rationale.

**Finding 3 — MAJOR. The backtest tests a different system than the spec deploys.**
`hp1_backtest.py` contains none of: cluster caps (§4), circuit breaker, 5-session hard-exit rule, migration logic, earnings event-sizing, Fable layer. Its category grouping (CAT_A/CAT_B) isn't even the L1–L5 taxonomy. The "backtested core" covers exactly: top-10 by composite + inverse-downside-dev weights + breadth gate. Every §4 rail is an unbacktested addition whose interaction effects are unknown (e.g., cluster caps would have forced out winning semis during the window — likely lowering returns).
**Fix:** implement §4 rails in the engine and publish the delta, or label them "unbacktested risk rails" in spec §6.

**Finding 4 — MAJOR. No statistical significance or parameter sensitivity anywhere.**
~50 rebalances over 24 months in one regime. No standard errors, no bootstrap, no sweep of: factor weights (.45/.35/.20), gate thresholds (40/25), top-N (10), cadences (10/21d), MA windows (100/200), cap (15%). Seven-plus free parameters chosen on the same window they're evaluated on is a large overfitting surface; with N≈50 selections the Sharpe difference vs benchmark is statistically indistinguishable from zero even before Finding 2.
**Fix:** bootstrap confidence intervals on the Sharpe delta; ±20% perturbation grid on every parameter; report ranges, not points.

**Finding 5 — MAJOR. Security-level survivorship beyond the disclosed universe-level caveat.**
Names enter scoring at 130 trading days with zM renormalized to 3m/6m only — hot post-IPO momentum names get scored on their best horizons with no 12m discipline. The 2023+ cohort was selected into the universe in June 2026 with full hindsight. Removing it cuts even the EW-50 benchmark from 81.0% to 66.5% CAGR — ~15 points of the *benchmark* is IPO-survivor inflation, and the strategy harvests the same names at higher weight. The disclosed "universe survivorship" caveat understates this because the EW-50 baseline is itself contaminated.
**Fix:** publish the ex-2023+-cohort record as the conservative case; consider requiring 252d history for full eligibility.

**Finding 6 — MAJOR. Tax reality is disclosed as a word ("pre-tax") but never quantified, and it's enormous.**
Measured annual turnover: 12.8x. At a 10-day cadence essentially 100% of gains are short-term. For a personal taxable account at ~35–40% marginal (fed+state), the corrected ~93% CAGR compounds post-tax dramatically closer to buy-and-hold alternatives, and the +10–12pt edge vs EW-50 may not survive taxes at all (EW-50 held passively generates almost no realized gains). This matters double for "me and my mom" money.
**Fix:** model post-tax outcomes explicitly; run the Tactical sleeve in tax-advantaged accounts if available; otherwise lengthen cadence and re-test.

**Finding 7 — MINOR (cluster).** (a) EW-50 benchmark is cost-free and daily-rebalanced — slightly conservative against the strategy, acceptable; (b) Sharpe computed on geometric CAGR — conservative, fine; (c) RF hardcoded 4%; (d) the 50/50 blend is implicitly rebalanced daily between sleeves at zero cost; (e) `results_24m.csv` is the only record in the package — the 36M table ("ordering holds") is asserted but absent. My rerun confirms ordering holds pre-correction; post-correction ex-IPO it does not (Finding 2).
**Fix:** ship the 36M CSV; note (a)–(d) in spec §6.

**Finding 8 — MINOR. `dd_dev` floor of 1e-4.**
A name with <6 negative days in 126 gets `dd_dev=1e-4`: its RAM ratio explodes (clipped to z=+3, guaranteed top decile) and its pre-cap weight explodes (capped at 15%). A synthetic edge for short-history smooth risers; interacts badly with Finding 5.
**Fix:** require ≥20 negative observations or fall back to total volatility; floor at a percentile of cross-sectional dd_dev, not 1e-4.

## A2 — Factor design vs the literature

**Finding 9 — MAJOR. The "replicated literature" lineage claims overstate fidelity.**
[Barroso & Santa-Clara 2015](https://www.sciencedirect.com/science/article/abs/pii/S0304405X14002566) and [Daniel & Moskowitz 2016](https://www.sciencedirect.com/science/article/pii/S0304405X16301490) manage the **momentum portfolio's** volatility through time (time-series scaling of WML exposure); Moreira-Muir likewise scales factor portfolios. HP-1's zRAM is a **cross-sectional per-name** return/downside-dev sort — a different mechanism ("Sharpe momentum") with a far thinner evidence base. The handoff's claim that "risk-managed momentum is the replicated literature" attributes the papers' validation to an implementation they don't cover. The breadth gate (Faber-style absolute trend) is the only component with a genuine lineage match.
**Fix:** relabel the lineage honestly; if you want the actual literature mechanism, add time-series vol-targeting of sleeve gross (scale by trailing realized vol), which is testable in the same engine.

**Finding 10 — MAJOR. Momentum evidence doesn't transfer to a 50-name single-theme universe.**
Jegadeesh-Titman/Carhart momentum is documented on thousands of stocks across sectors; in 50 highly correlated AI names, most cross-sectional dispersion is shared AI beta, and long-only relative momentum within one theme has no published support as an alpha source. This cuts against both systems — v2's downweight cited a long-short broad-market study (wrong regime), HP-1's defense cites in-sample contaminated measurement (Findings 1–2). Nobody in this debate has applicable evidence.
**Fix:** state it plainly in the spec: the momentum core is a risk-management and discipline device in a high-beta theme, not a validated alpha factor.

**Finding 11 — MINOR. Hidden signal concentration on the 6-month horizon.** r6 enters zM at 0.4 weight AND is the numerator of zRAM (0.35) — the Tactical score is ~60–70% a 6-month-return bet. Not wrong, but undisclosed; parameter fragility concentrates in one horizon.
**Fix:** document effective horizon exposure; consider using 12m return in RAM's numerator for diversification.

**Finding 12 — MINOR. v2's anti-momentum citation is junk-grade.** The "−10.2%/yr 2005–2024" study is an academia.edu-hosted non-peer-reviewed paper. The verdict doc's rebuttal of it is correct in direction (long-short ≠ long-only) but the package should stop citing it entirely, on either side.

## A3 — The six merge decisions

**Finding 13 — Verification: the verdict doc characterized v2 fairly on the facts.** I read the source doc independently. Confirmed: no exits, no sizing beyond static caps, quarterly cadence, no backtest (Part 4's own admission), macro multiplier max −15% on High-tier only. The comparison table is accurate. Retiring v2 as a standalone for an actively-traded account is **correct**.

**Finding 14 — MAJOR. Merge decision #4 threw away v2's only new-capital control, and HP-1 has no replacement.**
v2's macro gates did real work in its May 14 deployment: they drove the 70/30 staged entry and the 30% reserve — which is exactly why v2's drawdown was −6.8% vs HP-1's −12.2% in the 19-day window (the verdict doc concedes this in passing). The verdict evaluated the multiplier (inert, correctly dropped) but never noticed the gates' deployment-staging function. HP-1's breadth gate modulates **existing Tactical gross**; nothing in HP-1 modulates **how fresh capital enters**. For a $300–500K cash deployment, entry-staging is arguably the single most consequential risk decision and the merged system is silent on it.
**Fix:** add a staged-deployment rule to spec §4 — e.g., 3 tranches over 4–8 weeks, accelerated if breadth <40%, with the reserve at T-bills. (Note the ANTH module already does this with tranche windows — the equity sleeves deserve the same design.)

**Finding 15 — MAJOR. Merge decision #5 (momentum weights stand) was ratified on contaminated evidence.**
The sole quantitative support was the +31–42 pts / +0.5–0.7 Sharpe measurement (Finding 2). Post-correction, the honest statement is: the sort adds ~0–0.05 Sharpe over equal-weighting the same universe. This doesn't vindicate v2's downweight either (its replacement was untested), but the decision's "measured" status is gone — it's now an assumption.
**Fix:** re-open #5; either re-ratify explicitly as a judgment call, or test a momentum-light variant (e.g., 50% zM weight reduction) on the corrected engine before deployment.

**Finding 16 — MINOR. Silent universe deltas.** The merge kept HP-1's 50 over v2's 70 with "candidates at quarterly review," but no delta list exists; e.g., INTU (v2 slate, 65.5 Medium) silently vanished. **Fix:** produce the 70-vs-50 delta list before the first quarterly review.

Decisions #1 (L1–L5 taxonomy), #2 (Tier-A overlay at capped 25%, live-only — correctly refused to backtest on current fundamentals), #3 (S-signals as downgrade-only flags), and #6 (retire v2 standalone): **sound as ratified**, no objection.

## A4 — Fable rubric

**Finding 17 — MAJOR. `adjusted_pct` has no defined consumer — the rubric's central output is decisionally ambiguous.**
Spec §4: sleeves hold "top 10 eligible" by engine score. Rubric §5 produces adjusted percentiles. Neither doc states whether sleeve selection uses engine or adjusted percentile. If adjusted: a −20 swing every 2 days whipsaws entries and hands the LLM de facto portfolio-construction power, contradicting "not a second portfolio manager." If engine-only: adjustments are advisory and the bounds machinery is cosmetic.
**Fix:** define it. Recommended: adjusted_pct can **block new entries** (no entry if adjustment ≤ −10) and **accelerate** exits per the existing rule, but never changes ranks for selection and never forces exits. Write it into both docs.

**Finding 18 — MAJOR. "No citation, no effect" is not enforceable as written — LLMs fabricate citations.**
The rubric requires `{source, date, url}` but nothing validates that URLs resolve or contain the claimed fact. A hallucinated-but-plausible Reuters URL passes every rule in §6. The self-check ("every DOWNGRADE row traces to a citation") is performed by the same model that may have hallucinated it.
**Fix:** the orchestrator (not Fable) must fetch every evidence URL on DOWNGRADE/UPGRADE/VETO rows and verify date + keyword match before the verdict takes effect; validation failure demotes to FLAG. This is cheap (a few fetches per run) and closes the single biggest hole in the layer.

**Finding 19 — MAJOR. The Anthropic conflict mitigation is a disclosure, not a control.**
Rubric §9/rule 9: the model states "I am Anthropic-built" each run. Standing disclosure does nothing to de-bias the GO/WAIT/STOP output; if anything it ritualizes the conflict. Same issue applies to this whole package: designed by Claude, reviewed by a rubric Claude wrote, gating an investment in Claude's maker.
**Fix:** structural controls: (a) the ANTH block must enumerate the 3 strongest cited reasons NOT to invest, every run; (b) any GO recommendation requires sign-off from a non-Anthropic model or Terry's manual checklist before a tranche executes; (c) the ceiling multiple is set by Terry from third-party diligence (Part B of this review) and is hard-coded — Fable can only compare implied EV to it, never argue it upward. (c) is already implied by the spec; make it explicit that Fable output can never be cited as a reason to raise the ceiling.

**Finding 20 — MAJOR (evidence direction). The insider-signal asymmetry is backwards relative to the literature.**
Research consistently finds opportunistic insider **purchases** are the informative side; sales are mostly diversification noise (e.g., [Jiang & Ma 2023 via Alpha Architect](https://alphaarchitect.com/insider-trading-increases-market-efficiency/) — only non-preplanned trades reliably forecast returns, with buys carrying fundamental information). The rubric already excludes 10b5-1 sells (good), but it lets the weaker signal (sell clusters) downgrade while forbidding the stronger signal (buy clusters) from contributing to an upgrade. Internally consistent with "soft signals demote only," but it discards the one soft signal with positive predictive evidence.
**Fix:** allow a qualifying cluster buy (3+ insiders, ≥$1M, opportunistic) to count as ONE of the two hard citations required for UPGRADE. Keep everything else asymmetric.

**Finding 21 — MINOR. Double-counting priced news.** Fable's purpose is "what the tape hasn't priced," but no rule tests pricedness. A guidance cut from 4 days ago that already cratered the stock (and the engine score) can be cited for a further −15. **Fix:** if the cited event predates the last engine re-score and the name's drawdown already exceeds, say, 8% since the event, cap the adjustment at −5.

**Finding 22 — MINOR. No calibration loop or sunset criterion.** Run JSONs are persisted "to eventually backtest," but no metric or decision rule is defined. **Fix:** define now: at 6 months, compare forward 10-day returns of DOWNGRADE vs CONFIRM names; no separation → shrink bounds to [−5, 0] or strip the layer's scoring power. Also track Fable's exit-acceleration calls vs what the mechanical rule alone would have done.

**Finding 23 — MINOR. Bounds magnitude is arbitrary.** [−20,+5] direction is right (anti-narrative); the 20 is unjustified — it's 2 deciles, enough to flip a top-3 name below the entry boundary. **Fix:** start at [−10,+5] until calibration data exists (moot if Finding 17 resolves to advisory-only for selection).

**How the LLM reviewer still fails even with all fixes:** source-quality blindness (a seekingalpha post and a 10-Q carry equal weight in the schema — add a source-tier field), correlated errors across names in the same run (one bad macro narrative downgrades 10 names at once — cap aggregate per-run downgrades), and silent regression when the underlying model is updated (pin model versions; re-run a golden set of historical cases on every model change).

## A5 — Code (beyond Finding 1)

**Finding 24 — MINOR.** `weights()`: the 6-iteration cap-redistribution loop plus final `w/w.sum()` renormalization can leave names marginally above 15% in edge cases. Add `assert w.max() <= 0.15 + 1e-6`.
**Finding 25 — MINOR.** `dd_dev` is the std of negative returns (dispersion of down days), not root-mean-square below zero (the Sortino convention BS2015-style claims imply). Cross-sectionally consistent but mislabeled; penalizes many-small-down-days names vs few-large-crash names — arguably the wrong way around.
**Finding 26 — MINOR.** Breadth gate denominator only includes names with ≥130d history — early-window breadth ignores recent listings; small effect.
**Finding 27 — MINOR.** The self-test is trivial (3 synthetic series, monotonic). It cannot catch Finding 1, the renormalization path, the gate, or the cap loop. Add: a test asserting weights set at `t` earn no return at `t`; a test with a missing-horizon name; a gate threshold test.
Credit where due: the data-≤-t factor computation, the zM `isfinite` assertion (a real bug actually caught), dividend-adjusted closes, and cost-on-turnover math are all correct.

---

## What the package gets right (for balance)

The caveat discipline is far above hobbyist norm: universe survivorship named, EW-50 chosen as the honest benchmark, the 19-day check explicitly flagged as asymmetric and noise, the refusal to backtest the fundamental overlay on current fundamentals (a lookahead most retail systems happily commit), the overlay capped at 25% precisely because it's unbacktested, CONFIRM-as-default anti-manufactured-findings design, mechanical exits that the LLM can accelerate but never delay, and a pre-committed ANTH valuation ceiling. The architecture is sound. The published record and two of the six merge ratifications are what's broken.

## Verdict

**DO NOT SHIP** — not because the design is bad, but because the published record (110.5%/2.43) is inflated ~17–24 CAGR pts by an execution-timing bug, the corrected risk-adjusted edge over equal-weighting is ~zero, and merge decision #5 plus the spec's §3 rationale were ratified on that contaminated evidence. Path to SHIP WITH CHANGES is short: fix the simulator (1 day), restate the record, re-ratify #5 and add the staged-deployment rule (Finding 14), resolve adjusted_pct's role (Finding 17), and add citation validation (Finding 18). The system that emerges — a disciplined, drawdown-managed, top-10 trend portfolio with an honest ~+10pt concentration edge and real exits — is still a defensible personal strategy; it just isn't the 110%-CAGR Sharpe-2.4 machine the record claims.

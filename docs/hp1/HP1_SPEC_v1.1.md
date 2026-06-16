# HP-1 — AI Alpha Engine · Spec v1.1 (merged)
2026-06-11 · Supersedes v1 · Changelog at bottom

## 1. Mandate

Rank a fixed 50-name AI universe (+ Anthropic tracked separately) on **risk-adjusted momentum**, run two sleeves (Tactical 1–3mo / Core 12mo+, 50/50 capital), re-scored every 2–3 days with the Fable review layer (see `FABLE_REVIEW_RUBRIC_v1.md`). Target: best risk-adjusted return in the AI complex, $300–500K deployment. The engine ranks and explains; Terry decides.

Design principle: the backtestable core is price-action only. Fundamentals enter through the Core overlay (§5, AI Thesis v2 Tier-A machinery) and the Fable layer — deliberately NOT backtested; capped weight for exactly that reason.

## 2. Universe — fixed 50 + ANTH, L1–L5 layers

| Layer | Tickers | n |
|---|---|---|
| **L1 Compute** (semis, semicap, EDA, networking/optics, AI hardware) | NVDA AMD AVGO MRVL MU TSM ASML AMAT LRCX KLAC TER ARM MPWR ALAB CRDO SMCI SNPS CDNS ANET CLS FN COHR DELL | 23 |
| **L2 Hyperscaler** | MSFT GOOGL AMZN META ORCL | 5 |
| **L3a AI-Native software** | PLTR SNOW DDOG CRWD PANW APP TEM RDDT NET | 9 |
| **L3b Neocloud / AI DC** | CRWV NBIS IREN APLD | 4 |
| **L4 Power & infra** | VST CEG GEV NRG TLN VRT | 6 |
| **L5 Incumbent AI-driver** | AAPL TSLA NOW | 3 |

Layers serve two jobs: (a) v2's layer-specific fundamental scoring in §5; (b) correlation-cluster caps in §4 — L3 is split a/b for the cap because neocloud beta ≠ SaaS beta. Category views for the UI: **Pure-play** = L1+L3+L4, **Megacap** = L2+L5, plus the Combined re-ranked list. Universe fixed; changes only at quarterly review (Terry's call); <130 trading days history → tracked, ineligible. Excluded by design: pre-revenue/meme AI, DC REITs.

## 3. Scoring engine — unchanged from v1 (backtested)

Dividend-adjusted closes, data ≤ scoring date only, z-scores within view, winsorized ±3.

| Factor | Definition | Lineage |
|---|---|---|
| **zM** | 0.3·z(3m) + 0.4·z(6m, skip 5d) + 0.3·z(12m, skip 1m); renormalize if horizon missing | Jegadeesh-Titman 1993; Carhart 1997 |
| **zRAM** | z(6m ret ÷ downside deviation 126d ann.) | Barroso & Santa-Clara 2015; Moreira-Muir 2017 |
| **zDD** | z(−drawdown from 126d high) | Daniel & Moskowitz 2016 |
| **Trend gate** | Tactical: price > 100d MA · Core: > 200d MA (100d if <210 obs) | Faber 2007; MOP 2012 |

**Tactical** = 0.45·zM + 0.35·zRAM + 0.20·zDD. **Core** = [0.40·z(12m) + 0.35·zRAM + 0.25·zDD] × 0.75 + Overlay (§5) × 0.25.
Momentum weights are a ratified judgment call, not a measured edge. Corrected-timing backtests (2026-06-12, t+1 execution) show the sort adds ~+10–12 CAGR pts vs EW-50 with ~+0.05 Sharpe (24M), and ~zero Sharpe edge once the 2023+ listing cohort is excluded — the return edge is concentration, not risk-adjusted alpha. The system's measured value is drawdown management (gate: −27.7% vs −36.9% MaxDD) and exit discipline. Crash protection lives in RAM/DD/gates. `results_24m_v2.csv` / `results_36m_v2.csv` are the only citable record. Driver tags (`return-driven` / `stability-driven` / `balanced` / `broken trend`) print beside every rank.

## 4. Portfolio construction & risk rails

- Sleeves: Tactical re-scores every 10 trading days, Core every 21; each holds top 10 eligible. Fable layer runs every 2 trading days on top (rubric doc).
- Sizing: weight ∝ 1/downside-deviation, 15% single-name cap, iterative redistribution. **Cluster cap: no layer (L3 counted as a/b separately) > 40% of a sleeve.**
- Regime gate (Tactical): breadth = % of universe above 100d MA. ≥40% → 100% gross; 25–40% → 50%; <25% → 25%. Cash at T-bill. (v2's NAAIM/AAII/F&G multiplier dropped as a score mechanic — max −15% on High tier ≈ inert; the three gauges live on as Fable downgrade-only flags.)
- Staged deployment (new capital): fresh capital enters in 3 tranches over 4–8 weeks. Tranche 1 at start; each subsequent tranche releases at its planned date only if breadth ≥ 40%; if gated, hold at T-bill and re-check each engine run. Off-ramp: Terry may override with an explicit logged decision.
- Hard exits (mechanical — Fable may accelerate, never delay): close <100d MA 5 consecutive sessions → Tactical exit / Core review · −20% from position high → same-day forced Fable review. · SPY single-day ≤ −5% or VIX ≥ 25 for 3+ consecutive sessions → off-cycle Fable run (portfolio-level review, not an automatic exit).
- Migration: |Tactical-percentile − Core-percentile| > 25 pts for 3 consecutive runs → flag; Fable confirms; Terry executes.
- Role of `adjusted_pct` (binding definition): sleeve selection ranks on ENGINE percentile only. Fable adjustments (a) block new entries — a name with adjustment ≤ −10 in the latest run is ineligible to enter a sleeve this rebalance; (b) may accelerate mechanical exits per the existing rule; (c) never reorder ranks, never force exits, never delay anything. Enforced in the orchestrator, not by prompt.
- Circuit breaker: portfolio −12% from high-water → Tactical gross halved until breadth >40%.
- Earnings rule: new Tactical entries within 5 trading days of a confirmed print are event-sized (half weight) and flagged on the decision sheet.

## 5. Core fundamental overlay — AI Thesis v2 Tier-A machinery (live-only, 25% of Core)

Q/G/V/AIQ, weights renormalized from v2's {Q 22, G 22, V 14, AIQ 18} → **Q 28.9% · G 28.9% · V 18.4% · AIQ 23.7%** of the overlay. All z-scored **within layer**, then percentiled.

- **Q (Quality, QMJ-adapted):** profitability (GP/assets, ROIC, FCF/rev, op margin) + 5y trajectory + safety (−beta, −leverage, −earnings vol, Altman Z) + payout (half-weight for L1–L3).
- **G (AI-levered growth):** consensus NTM revenue growth + AI-segment proxy + **layer-specific capex efficiency** (L1 rev/capex · L2 incremental cloud rev / incremental capex T12M · L3 AI ARR/opex · L4 contracted MW pipeline value/capex · L5 AI-ARR/AI spend).
- **V (Valuation):** EV/EBITDA-to-growth + adjusted FCF yield using **mid maintenance-capex estimate** (50% of current capex; low/high band reported, divergence → "regime-dependent" flag, sized at lower implied position) + own-history forward-P/E z. **Minus depreciation/accounting penalty:** useful-life extension ≤0.5y −3 · 0.5–1.0y −5 · 1.0–1.5y −7 · >1.5y −10; named-overstatement add-ons (ORCL −5, META −3, other disclosed extenders −2); total cap −12.
- **AIQ:** v2 rubric (disclosure 20 / defensibility 20 / concentration 15 / capex-eff 15 / independent demand 15 / accounting 15), hand-scored quarterly after each earnings cycle (next: Aug 2026), Fable-assisted draft → Terry ratifies.

Data: FMP `/stable/` + Massive (existing keys). Unbacktested → weight stays capped at 25% of Core until point-in-time history accumulates in `scores_history` for walk-forward testing (12+ months out).

## 6. Backtest record — see v1 §6

Canonical record: `engine/data/results_24m_v2.csv` + `results_36m_v2.csv` (corrected t+1 execution, 2026-06-12). The original v1 record contained a same-day execution lookahead worth ~17–24 CAGR pts and is void — never quote it. Caveats, now six, mandatory in any restatement: (1) universe survivorship — including security-level: the 2023+ listing cohort inflates both strategy and EW benchmark (ex-cohort variants are in the record); (2) single regime; (3) pre-tax — at ~12.8x annual turnover effectively all gains are short-term; quantify against the holder's marginal rate before sizing; (4) 15 bps/side, no impact modeling; (5) the backtest covers top-10 selection + inverse-downside-dev weights + breadth gate ONLY — cluster caps, circuit breaker, hard exits, migration, earnings sizing, and the Fable layer are unbacktested rails; (6) ~50 rebalances in 24 months: differences vs benchmark are not statistically significant. Project the relative edge, never the absolute CAGR.

## 7. Anthropic module — unchanged from v1 §7

Filed for IPO (fetched 2026-06-11). Path: conditional brokerage IPO allocation + pre-committed valuation ceiling + tranche entries (allocation/day-1 · post-first-earnings · lockup window); secondary-at/below-last-round the only pre-IPO exception. **Open parameter (Terry): the ceiling number** — set as max EV / verified revenue run-rate after the diligence pass pins the run-rate source. Fable runs the ANTH block every cycle (rubric §9). Disclosure stands: Claude is Anthropic-built; the numbers drive the decision.

## 8. Operating cadence

Every 2 trading days, post-close: prices refresh → engine re-scores → **Fable review pass** (rubric doc) → decision sheet (UI, phase 4). Every 10/21 trading days: sleeve rebalances. Monthly: Core overlay refresh. Quarterly: AIQ re-score + universe review. Event triggers for off-cycle Fable runs: hard-exit trip, single name −8% day, circuit breaker, ANTH filing news.

## Changelog v1 → v1.1

1. L1–L5 layer taxonomy adopted (L3 split a/b for cluster caps). 2. §5 replaced with v2 Tier-A machinery incl. depreciation/Burry penalty. 3. v2 S-signals + sentiment gauges moved to Fable rubric as downgrade-only flags. 4. v2 macro multiplier dropped; breadth gate remains the exposure mechanic. 5. Momentum weights unchanged (evidence in verdict doc). 6. AI Thesis v2 retired as standalone for this account. Plus: earnings event-sizing rule added to §4.

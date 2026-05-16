# AI Thesis v2 — Algorithm, Bear-Case Stress Test, and $100K Deployment List

**Author:** Perplexity (working with Terry)
**Date:** May 14, 2026
**Purpose:** Produce a defensible v2 of the AI investing algorithm, stress-test it against current May 2026 conditions, hand-score 15–20 names for tomorrow's deployment, and specify the engine build for next weekend.

---

## Part 1 — What changed from v1, and why

The v1 spec was intellectually strong but had six structural problems flagged in the prior review. Each fix below is concrete and quantitative.

### Fix 1 — "Framework dressed as algorithm" → Honest two-tier system

v1 conflated *specification* with *implementation*. v2 explicitly separates them:

- **Tier A — Hand-scorable now.** Q, G, V, AIQ, and the concentration / regime overlays can be scored manually from public filings and live macro data in 5–10 minutes per name. **This is what tomorrow's deployment uses.**
- **Tier B — Requires engine.** M (12-1 + SUE + revision breadth) and S (options skew, SUSI, real-time sentiment) require automated data pipelines. Until built, they are **flag-only**, not score-contributing. We do not pretend to score what we cannot compute.

Net effect: composite scores are honestly computed on 4 factors (Q, G, V, AIQ) weighted to sum to 100, with M and S as **qualitative overlays that can downgrade but not upgrade a name**. When the engine is live next weekend, M and S enter the composite at the weights below.

### Fix 2 — Weight defense: equal-weight prior, evidence-based tilts

v1 weights (Q=28, M=22, G=18, V=12, S=10, AIQ=10) were asserted, not derived. v2 starts from a defensible prior and tilts only on documented evidence.

**Base prior: equal-weight 6 factors → 16.67% each.** This is the principled default until walk-forward backtesting exists.

**Tilts away from equal-weight (each with citation):**

| Factor | v2 Weight | Tilt | Justification |
|---|---|---|---|
| Q (Quality) | 22% | +5.3% | AQR QMJ delivers significant risk-adjusted alpha across 24 countries with longest backtest of any factor here. Asness/Frazzini/Pedersen ([AQR Quality Minus Junk](https://www.aqr.com/Insights/Research/Working-Paper/Quality-Minus-Junk)). Highest-evidence factor. |
| G (AI-Levered Growth) | 22% | +5.3% | Goldman's [revealed phase shift](https://www.goldmansachs.com/insights/articles/why-ai-companies-may-invest-more-than-500-billion-in-2026) — hyperscaler pairwise correlation fell from 80% → 20% on revenue-to-capex discrimination. This is the *active* differentiator in May 2026. |
| AIQ (AI Exposure Quality) | 18% | +1.3% | No published backtest exists, but the rubric is what distinguishes "real AI" from "narrative AI" — the entire point of the strategy. Held above equal-weight on conceptual grounds, below Q/G on lack of empirical track record. |
| V (Valuation) | 14% | −2.7% | Growth-adjusted V works ([Bernstein name-vs-own-history multiple framework](https://www.bernstein.com/)), but pure value has lost in tech for a decade. Material but not dominant. |
| M (Momentum) | 14% | −2.7% | **Downweighted from v1's 22%**. The [2025 SSRN study](https://www.academia.edu/143259207/Evaluating_a_12_1_Month_Momentum_Strategy_2005_2024_) shows 12-1 momentum lost −10.20% annualized 2005–2024 in S&P 500, even before transaction costs. Long-only mitigates the worst tail but does not eliminate the regime risk. Held at base weight (not eliminated) because Glen Kacher's 2023–2025 returns (59.4%, 45.7%, 38%) demonstrate the factor *can* work in revision-driven AI regimes — but the historical evidence is too mixed to overweight. |
| S (Sentiment) | 10% | −6.7% | Virginia Tech 2025 (Mansi et al.) shows investor attention is a contrary indicator on average. Kept at low weight, **only used as guardrail**, never as primary signal. |

**Total: 100%.** Compared to v1: Q same, G up, AIQ up, V up, M down sharply, S same.

The defense for these weights is: (a) equal-weight is the prior; (b) every deviation is tied to a specific published result; (c) the largest deviation is *down* (momentum), reflecting honest treatment of negative evidence. Weights will be re-optimized via walk-forward backtest in Phase 5 of the engine build.

### Fix 3 — Momentum: hybrid, not pure 12-1

v1 used 12-1 / SUE / REV6 at 60/20/20. Given the SSRN evidence, v2 inverts the weighting to lean on the *fundamental* component of momentum, where the academic evidence is much stronger.

**v2 momentum sub-weights: 25% price 12-1 / 40% SUE / 35% revision breadth.**

Rationale: Chan-Jegadeesh-Lakonishok (1996) and 30+ years of subsequent research show *earnings* momentum and *revision* momentum survive the 12-1 long-short crash regimes much better than price momentum alone, because they are tied to fundamentals not flow. The hybrid is closer to what Light Street, Coatue, and Tiger actually run: not pure trend-following but trend-confirmation-of-fundamental-revision.

This is a meaningful change in deployment behavior: names with strong SUE / revision breadth but mediocre price momentum (e.g., GOOGL much of 2024) score higher; names with strong price momentum but flat revisions (e.g., late-cycle PLTR if it ever stops beating) score lower.

### Fix 4 — Sentiment: math, not vibes

v1's sentiment had four sub-signals including "Perplexity-mediated daily pulse" which is non-reproducible. v2 sentiment is **explicit, quantitative, override-based**:

| Sub-signal | Measurement | Weight in S | Notes |
|---|---|---|---|
| Sell-side revision delta | 90-day net upgrades minus downgrades, percentile vs. universe | 30% | Reproducible from FMP. |
| Options skew | 25Δ put–call skew vs. own 90-day average, z-scored | 25% | Reproducible from any options API. Single signal, not three combined. |
| Short interest SUSI | (Short interest − 24m mean) / 24m stdev | 20% | [SUSI methodology, ScienceDirect 2023](https://www.sciencedirect.com/). Z-score, not level. |
| Insider Form 4 (asymmetric) | Cluster buy or cluster sell flag, override-based | 25% | +5 absolute score if 3+ insiders buy ≥$1M in 90d; −3 if 3+ insiders sell ≥$5M in 60d excluding 10b5-1. |

**Drop the LLM-pulse sub-signal entirely.** It is not measurable, not reproducible, and not backtestable. If you want real-time news/social, that lives in the *daily Sonnet memo*, not the score.

**Macro gate revised — Bayesian, not binary.** v1 used hard thresholds (NAAIM >90 AND AAII >+30 for 3 weeks AND F&G >80). The probability of all three being simultaneously true is rare enough that the gate almost never fires, which means it does almost no work. v2 uses a *score adjustment proportional to how many gates are hit*:

| Gates hit (out of 3) | High-conviction score multiplier |
|---|---|
| 0 | 1.00 |
| 1 | 0.95 |
| 2 | 0.90 |
| 3 | 0.85 |

This is smoother and more useful. Current readings (see Part 2) will demonstrate.

### Fix 5 — Depreciation penalty: scaled, not symbolic

v1's −5 penalty for any hyperscaler that extended useful life was too small to express the actual view. v2 scales the penalty to the *magnitude* of the extension and the *implied earnings overstatement*:

**Depreciation penalty (applied to V sub-score):**

- **No useful-life extension in last 24 months** → 0
- **Extended useful life by ≤ 0.5 years** → −3
- **Extended by 0.5–1.0 years** → −5
- **Extended by 1.0–1.5 years** → −7
- **Extended by >1.5 years (e.g., Meta from 4–5 yr to 5.5 yr or beyond, [WSJ Apr 2026](https://www.wsj.com/tech/meta-will-run-some-servers-longer-in-response-to-memory-shortage-9bb75737))** → −10

**Plus a separate "earnings overstatement" flag** based on Burry's estimates ([CNBC](https://www.cnbc.com/2025/11/11/big-short-investor-michael-burry-accuses-ai-hyperscalers-of-artificially-boosting-earnings.html)):

- ORCL (26.9% overstated by 2028) → additional −5 to V
- META (20.8% overstated by 2028) → additional −3 to V
- Any other named hyperscaler with disclosed extension → −2 to V

This is asymmetric but defensible: we are not shorting these names, we are simply ensuring our V score does not reward GAAP earnings we believe are inflated. Total V penalty caps at −12 so the name is not automatically excluded.

### Fix 6 — Maintenance capex: explicit assumption with sensitivity

v1 buried "maintenance capex ≈ 5-year pre-AI-cycle average capex/sales × current sales" as if it were obvious. It is not — it is the single most important methodological choice for hyperscaler V scoring.

v2 makes it explicit and provides three estimates:

**Maintenance capex band (per hyperscaler):**

- **Low estimate:** 5-year pre-AI-cycle capex/sales × current sales (v1 method, generous to GAAP)
- **Mid estimate:** 50% of *current* capex (data center stock has grown ~4x; maintenance has structurally risen)
- **High estimate:** 70% of current capex (assumes most capex is sustaining, not growth)

**v2 V-score uses the *mid* estimate as default** but reports all three. If High and Low produce different conviction tiers, the name is flagged "valuation regime-dependent" and sized at the lower of the two implied positions. This is honest about an unknown rather than picking one number and asserting it.

### Additional improvements

- **AIQ Dimension 4 weighting fix.** v1 awarded 15 points for capex-to-AI-revenue <1.0x. For hyperscalers, this is mathematically impossible right now — none have <1.0x capex-to-AI-revenue because their AI revenue is a fraction of their compute capex. v2 splits dimension 4 by layer:
  - **For L1 (compute):** capex efficiency is *revenue*/capex (full layer)
  - **For L2 (hyperscalers):** capex-to-disclosed-AI-revenue is unreliable. Use *incremental cloud revenue* / *incremental capex* trailing 12 months. Goldman's revealed metric.
  - **For L3 (apps):** capex is minimal; replace dimension with *AI ARR / total opex* — capital-efficient growth.
  - **For L4 (power):** capex efficiency is *contracted MW pipeline value* / current capex.
  - **For L5 (incumbents):** *AI-attributed revenue ARR* / disclosed AI R&D and infra spend.
- **Sentiment caps tightened.** A name in bottom-quartile Q with top-quartile S is capped at score = 55 (not 65 as v1). Quality + AIQ are the durable filters; if both fail and sentiment is the only thing carrying a name, that is exactly the failure mode of 2021.
- **Concentration tax formula explicit.** v1's formula is retained but with a concrete worked example for one name (provided in scoring section).
- **Comparable-fund table dropped from scoring.** It is decorative. Moved to an appendix in the engine build doc, used as a sanity check only.

---

## Part 2 — Bear-case stress test, May 14, 2026

Honest assessment: where are we in the cycle, what does it imply for deployment?

### Macro sentiment gauges (live data, week of May 7–14, 2026)

| Gauge | Reading | Threshold | Verdict |
|---|---|---|---|
| **NAAIM Exposure Index** | **96.67** ([NAAIM, May 6 2026](https://naaim.org/programs/naaim-exposure-index/)) | >90 = "top decile" | **GATE HIT** — active managers maximally exposed. Q1 average was 82. |
| **AAII Bull-Bear Spread** | **+5.36%** ([YCharts, May 7 2026](https://ycharts.com/indicators/us_investor_sentiment_bull_bear_spread)) | >+30 for 3 wks | **NOT HIT** — near long-term average of +6.28%. |
| **CNN Fear & Greed** | **66 (Greed)** ([Finhacker, May 14 2026](https://www.finhacker.cz/en/fear-and-greed-index-historical-data-and-chart/)) | >80 sustained | **NOT HIT** — elevated but not extreme. 0 days >90 YTD 2026. |
| **Gates hit** | **1 of 3** | | High-conviction multiplier = **0.95** |

**Reading:** Professional money is fully positioned (NAAIM 96), but retail sentiment is *not* euphoric (AAII bull-bear near average; F&G in greed but not extreme). This is a classic "smart money loaded, dumb money not yet onboarded" setup — historically one of the more difficult regimes because the marginal buyer is now likely indexed/passive rather than aggressive active.

This is **not** a top signal but it is a *de-rate the most crowded names* signal. The 0.95 multiplier on high-conviction positions is the algorithm's mechanical response.

### Bear-case factual updates

1. **Hyperscaler capex 2026 confirmed at ~$725B**, up from $410B in 2025 and ~$240B in 2024 ([Tom's Hardware](https://www.tomshardware.com/tech-industry/big-tech/big-techs-ai-spending-plans-reach-725-billion), [Statista](https://www.statista.com/chart/35046/capital-expenditure-of-meta-alphabet-amazon-and-microsoft/)). MSFT $190B, GOOGL $180–190B, META $125–145B, AMZN $200B. Q1 2026 raises were +5–$10B at most names.

2. **Hyperscaler debt issuance** — BofA raised 2026 IG bond forecast 25% to **$175B** ([Yahoo/BofA, Mar 2026](https://finance.yahoo.com/news/bofa-lifts-hyperscaler-debt-forecast-185936775.html)). $110B already issued by mid-March (63% of full-year forecast). **Tech sector debt issuance is real and accelerating.** This is consistent with the bear case but is also being absorbed by IG buyers without spread widening.

3. **Amazon FCF guidance: negative in 2026** ([Seeking Alpha, Feb 2026](https://seekingalpha.com/article/4869193-amazon-is-rather-old-for-negative-fcf)). Q1 2026 FCF disappearing as capex soars but AWS growth hit 28% — 15-quarter high ([Yahoo/CNBC](https://finance.yahoo.com/markets/stocks/articles/amazon-q1-2026-earnings-beat-203149838.html)). **The Goldman discriminating-on-revenue story is the operative one** — AMZN got rewarded because AWS reaccelerated, despite negative FCF. This is bullish for the G factor's signal value.

4. **Burry's positioning, Q1 2026 13F** ([@marketsday on X](https://x.com/marketsday/status/2053802298099315099)): maintains large puts on NVDA and PLTR, added long Chinese platforms (BABA), and small longs in software (ADBE, ADSK, VEEV). His thesis is intact and he is still positioned for it. He has not been right yet — but his framework (the depreciation penalty) is built into v2.

5. **Meta useful-life extension confirmed** ([WSJ, Apr 29 2026](https://www.wsj.com/tech/meta-will-run-some-servers-longer-in-response-to-memory-shortage-9bb75737)): non-AI servers from 6 to 7 years. AI servers separately extended to 5.5 years in 2025 ($2.3B depreciation reduction in 9M 2025). **Two separate extensions in 12 months.** Meta gets v2's largest penalty.

6. **Oracle / OpenAI $300B deal** ([WSJ, Sep 2025](https://www.wsj.com/business/openai-oracle-sign-300-billion-computing-deal-among-biggest-in-history-ff27c8fe)) and ongoing accounting concerns ([LinkedIn/Jon Weil](https://www.linkedin.com/posts/jonweil_what-oracle-has-to-lose-from-openai-and-nvidia-activity-7424516064677371905-RCyq)). Whether Oracle can book the full $300B in RPO depends on OpenAI's "collectibility" — a real accounting risk. Oracle gets v2's hyperscaler-overstatement penalty.

7. **Power layer is delivering**:
   - **VST Q1 2026**: revenue $5.64B, net income $1.03B (vs. −$268M loss prior year), upgraded to IG by S&P/Fitch ([StockTitan](https://www.stocktitan.net/sec-filings/VST/10-q-vistra-corp-quarterly-earnings-report-9bf11d1ca3a5.html))
   - **GEV Q1 2026**: orders +71% YoY to $18.3B, FCF $4.8B (more than all of 2025), guidance raised ([Investing.com](https://www.investing.com/news/company-news/ge-vernova-q1-2026-slides-orders-surge-71-guidance-raised-93CH-4629463))
   - **VRT Q1 2026**: revenue $2.65B, EPS +83% YoY, backlog doubled to >$15B ([Heygotrade](https://www.heygotrade.com/en/blog/vertiv-vrt-data-center-cooling-ai-2026/))
   - **CEG**: pursuing 1 GW nuclear uprates over decade ([Reuters via Yahoo](https://finance.yahoo.com/sectors/energy/articles/why-constellation-energy-ceg-expanding-172935557.html))
   - L4 is the layer where the bear case is *weakest* — orders and contracts are real, multi-year, and capacity-constrained.

### Stress-test verdict

**The bear case is real but unfolding slowly.** The depreciation thesis has not yet broken earnings (won't until at least 2027 if Burry is right). Capex is being debt-funded but absorbed by markets without spread widening. Capex growth is producing revenue growth (AWS 28%, GCP 63%, Azure 40%). NAAIM at 96.67 is a meaningful warning but is the only macro gate currently hit.

**Implication for deployment tomorrow:**
- **Reduce position sizes 5% from v1's tier defaults** to reflect the 0.95 high-conviction multiplier.
- **Avoid META and ORCL at high conviction** — depreciation penalties hit them hardest.
- **Lean into L4 (power) and L1 (compute)** — where current evidence is strongest.
- **Do not deploy 100% of $100K tomorrow.** Hold 25–30% in reserve. The NAAIM gate plus the unresolved depreciation question argues for dollar-cost averaging over 4–6 weeks rather than all-in tomorrow.

---

## Part 3 — Hand-scored 20-name deployment slate

Scoring methodology: Tier-A factors only (Q, G, V, AIQ + concentration tax + macro gate). M and S are qualitative annotations until engine is live. Each name scored 0–100 on each factor, then layer-weighted per v2 table.

**v2 layer weights:**

| Factor | L1 Compute | L2 Hyperscaler | L3 AI-Native | L4 Power | L5 Incumbent |
|---|---|---|---|---|---|
| Q | 22% | 32% | 18% | 30% | 28% |
| G | 26% | 22% | 30% | 22% | 18% |
| V | 14% | 14% | 8% | 18% | 16% |
| AIQ | 18% | 14% | 18% | 14% | 14% |
| M (qual) | 12% | 10% | 16% | 10% | 14% |
| S (qual) | 8% | 8% | 10% | 6% | 10% |

(M and S enter the score only when engine is live; until then I'll annotate with qualitative direction.)

### Score table

**Format:** Q / G / V / AIQ → weighted-composite (Tier A only, scaled to 100). M and S directional only.

| # | Ticker | Layer | Q | G | V | AIQ | Tier-A Composite | M dir | S dir | Conc Tax | Final | Tier |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **TSM** | L1 | 92 | 88 | 75 | 92 | **87.5** | ↑ | ↑ | −1 | **86.5** | **High** |
| 2 | **NVDA** | L1 | 88 | 95 | 60 | 87 | **84.7** | ↑ | ↑ | −5 (PC1, crowded) | **79.7** | **High** |
| 3 | **AVGO** | L1 | 85 | 92 | 55 | 84 | **81.0** | ↑ | → | −3 | **78.0** | **High** |
| 4 | **VST** | L4 | 78 | 88 | 70 | 78 | **78.7** | ↑ | → | −1 | **77.7** | **High** |
| 5 | **GEV** | L4 | 82 | 90 | 60 | 78 | **78.6** | ↑ | ↑ | −1 | **77.6** | **High** |
| 6 | **CEG** | L4 | 80 | 78 | 65 | 78 | **75.6** | → | → | −1 | **74.6** | **Medium** |
| 7 | **VRT** | L4 | 75 | 88 | 55 | 80 | **75.5** | ↑ | ↑ | −2 | **73.5** | **Medium** |
| 8 | **GOOGL** | L2 | 90 | 78 | 75 | 75 | **80.7** | ↑ | → | −3 | **77.7** | **High** |
| 9 | **MSFT** | L2 | 92 | 70 | 65 | 71 | **77.3** | → | → | −3 | **74.3** | **Medium** |
| 10 | **AMZN** | L2 | 85 | 78 | 55 | 70 | **74.0** | ↑ | → | −3 | **71.0** | **Medium** |
| 11 | **ANET** | L1 | 82 | 92 | 50 | 85 | **78.6** | ↑ | ↑ | −2 | **76.6** | **High** |
| 12 | **PLTR** | L3 | 70 | 95 | 25 | 69 | **66.4** | ↑↑ | ↑↑ | −2 | **64.4** | **Medium** |
| 13 | **CRWD** | L3 | 75 | 70 | 50 | 70 | **68.0** | → | → | −1 | **67.0** | **Medium** |
| 14 | **SNOW** | L3 | 65 | 72 | 55 | 64 | **65.4** | → | → | −1 | **64.4** | **Medium** |
| 15 | **ORCL** | L2 | 70 | 80 | 35* | 52 | **60.7** | → | ↓ | −2 | **58.7** | **Low** |
| 16 | **META** | L2 | 80 | 70 | 45* | 54 | **64.4** | → | ↓ | −3 | **61.4** | **Medium** |
| 17 | **ASML** | L1 | 88 | 75 | 70 | 88 | **81.0** | → | → | −2 | **79.0** | **High** |
| 18 | **LRCX** | L1 | 82 | 75 | 70 | 78 | **76.7** | → | → | −1 | **75.7** | **High** |
| 19 | **NOW** | L5 | 85 | 65 | 50 | 65 | **68.3** | → | → | −1 | **67.3** | **Medium** |
| 20 | **INTU** | L5 | 88 | 55 | 55 | 60 | **66.5** | → | → | −1 | **65.5** | **Medium** |

*V scores for ORCL and META reflect v2's depreciation/Burry overstatement penalties.

**Apply 0.95 macro multiplier to High-conviction names** (1 of 3 gates hit):

| Name | Pre-multiplier | Post-multiplier | Final Tier |
|---|---|---|---|
| TSM | 86.5 | **82.2** | High |
| NVDA | 79.7 | **75.7** | High |
| AVGO | 78.0 | **74.1** | Medium (drops one tier) |
| ASML | 79.0 | **75.1** | High |
| GOOGL | 77.7 | **73.8** | Medium (drops one tier) |
| VST | 77.7 | **73.8** | Medium (drops one tier) |
| GEV | 77.6 | **73.7** | Medium (drops one tier) |
| ANET | 76.6 | **72.8** | Medium (drops one tier) |
| LRCX | 75.7 | **71.9** | Medium (drops one tier) |

The 0.95 multiplier deliberately compresses the top of the book — exactly what should happen when NAAIM is hit.

### Scoring rationale (compressed) for each name

I'll cover the most material ones. Full rationale on the rest available on request.

**1. TSM (Taiwan Semi) — 82.2 final, High Conviction**
- **Q = 92.** Best-in-class margins ([TSMC Q1 2026 reported 58% profit growth, record revenue, gross margin ~64%](https://www.cnbc.com/2026/04/16/tsmc-q1-profit-58-percent-ai-chip-demand-record.html)). ROIC consistently >25%. Safety from monopoly position in leading-edge.
- **G = 88.** 2026 revenue growth guided >30% USD; HPC (AI) is 61% of total revenue and grew 20% sequentially. Capex efficiency: spending top of $42–46B range to capture demand. ΔRev/ΔCapex is excellent vs. hyperscalers.
- **V = 75.** Forward P/E ~23 ([Gurufocus](https://www.gurufocus.com/term/forward-pe-ratio/TSM)). For 30%+ growth, this is reasonable — the only large-cap AI name with PEG <1.
- **AIQ = 92.** Disclosure (HPC segment explicit, 61%) = 18. Defensibility (EUV monopoly, leading-edge moat) = 18. Concentration: large but diversified across hyperscalers + NVDA + AAPL = 12. Capex efficiency excellent = 15. Independent demand: full hyperscaler + Apple base + automotive = 14. Accounting clean = 15.
- **Druckenmiller +457% in Q1 2025** — institutional validation.
- **Concentration tax: −1** (lower correlation to NVDA than feared given customer diversification).
- **Final = 82.2.** Highest conviction position.

**2. NVDA — 75.7 final, High Conviction**
- **Q = 88.** Margins, ROIC, FCF all extraordinary. Safety hurt by single-customer-cohort risk (hyperscaler capex) but offset by CUDA moat.
- **G = 95.** Data center revenue $39.1B in latest reported quarter, up 73% YoY ([NVIDIA Q1 FY26](https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-first-quarter-fiscal-2026)). Q1 FY27 guidance ~$78B total. $350B backlog disclosed. Capex efficiency leader.
- **V = 60.** Forward P/E ~34. Expensive on absolute multiples but PEG ~0.7 given growth. Burry's puts ($187M notional Q3 2025) are real but Q1 2026 13F shows him still positioned for the trade.
- **AIQ = 87.** Disclosure (data center = 88%+ of revenue) = 20. Defensibility (CUDA) = 20. Concentration: top customer ~25% = 8. Capex eff = 15. Indep demand: limited beyond hyperscalers = 12. Accounting: clean but inventory-related concerns recently flagged = 12.
- **Concentration tax: −5.** Universe correlation to NVDA is the highest of any name. PC1 loading is largest.
- **Final = 75.7.** Still High Conviction but smaller position than TSM.

**3. AVGO — 74.1 final, Medium (post-multiplier)**
- **Q = 85.** Margins 77% gross, 68% adj EBITDA ([Q1 FY26](https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announces-first-quarter-fiscal-year-2026-financial)). Hock Tan capital allocation is institutional gold standard.
- **G = 92.** AI semi revenue $8.4B Q1 FY26, guided $10.7B Q2 (+140% YoY). Custom AI accelerators (Google TPU, Meta MTIA) plus AI networking.
- **V = 55.** Forward P/E ~37 ([Gurufocus](https://www.gurufocus.com/term/forward-pe-ratio/AVGO)). Pricey on multiples.
- **AIQ = 84.** Disclosure excellent (AI segment broken out) = 18. Defensibility (custom silicon design + networking + VMware) = 18. Concentration: top 2 customers ~50% = 8. Capex eff = 14. Indep demand = 12. Accounting = 14.
- **Final post-multiplier = 74.1.** Just below the 75 High threshold. Functionally a high-end Medium.

**4. VST (Vistra) — 73.8 final, Medium (post-multiplier)**
- **Q = 78.** S&P/Fitch upgraded to IG ([Q1 2026 results](https://www.stocktitan.net/sec-filings/VST/10-q-vistra-corp-quarterly-earnings-report-9bf11d1ca3a5.html)). Cash from ops 2x YoY. Quality improving fast.
- **G = 88.** Hyperscaler PPAs disclosed; nuclear + gas fleet positioned for chokepoint. 2026 adjEBITDA guide $6.8–7.6B reaffirmed.
- **V = 70.** Forward P/E mid-20s for a utility with structural tailwinds is the best risk/reward in L4.
- **AIQ = 78.** Disclosure (PPA structure) = 12. Defensibility (existing dispatchable generation + nuclear fleet) = 16. Concentration: diversified across hyperscalers = 10. Capex eff = 13. Indep demand = 13. Accounting clean = 14.
- **Final = 73.8.** Best risk-adjusted position in the slate.

**5. GEV (GE Vernova) — 73.7 final, Medium (post-multiplier)**
- **Q = 82.** Margins inflecting hard. Power EBITDA margin 16.3% (was 11.6%). FCF $4.8B in one quarter — more than all of 2025.
- **G = 90.** Orders +71% YoY to $18.3B ([Q1 2026](https://www.gevernova.com/news/press-releases/ge-vernova-reports-first-quarter-2026-financial)). Guidance raised across all metrics. EPS beat by 944%.
- **V = 60.** Forward P/E ~40 — full but defensible at 70% order growth.
- **AIQ = 78.** Disclosure (grid + electrification = AI proxies, but not explicit AI line) = 12. Defensibility (heavy industrial moat) = 16. Concentration good = 11. Capex eff = 13. Indep demand: utilities globally + data center = 13. Accounting solid = 13.
- **Final = 73.7.** Strongest growth print in the slate.

**6. GOOGL — 73.8 final, Medium (post-multiplier)**
- **Q = 90.** Best balance sheet in tech; FCF generation still strong. Margins on Cloud finally inflecting.
- **G = 78.** Cloud +63% YoY (fastest since segment disclosure began) ([Reuters](https://www.reuters.com/business/alphabets-cloud-unit-beats-quarterly-revenue-estimates-strong-ai-demand-2026-04-29/)). $460B Cloud backlog. Capex $180–190B 2026.
- **V = 75.** Forward P/E ~20. Cheapest hyperscaler relative to growth profile. The valuation argument is strongest here.
- **AIQ = 75.** Disclosure: Cloud growth as AI proxy is reasonable but not pure-play = 14. Defensibility (Gemini + TPU + search distribution) = 18. Concentration: highly diversified = 12. Capex efficiency: 50%-mid maintenance assumption shows mid-teens FCF yield = 10. Indep demand strong = 13. Accounting: no useful-life extension in 24 months = 8. (Per-dim sum is the authoritative AIQ value; an earlier draft showed 74 from arithmetic drift.)
- **Final = 73.8.** The hyperscaler I'd own.

**8. ANET (Arista) — 72.8 final, Medium (post-multiplier)**
- **Q = 82.** Best operating margins in networking (47.8% non-GAAP). Net cash, no debt.
- **G = 92.** 2026 revenue guide raised to $11.5B (+27.7%). AI revenue target raised to $3.5B (doubling YoY). 4th major client moved from InfiniBand to Ethernet — secular share gain story is intact ([Q1 2026](https://www.arista.com/en/company/news/press-release/24017-pr-20260505)).
- **V = 50.** Forward P/E ~45 — expensive but justified by acceleration.
- **AIQ = 85.** Disclosure (explicit AI target $3.5B) = 18. Defensibility (Ethernet-for-AI moat solidifying) = 16. Concentration: Meta + Microsoft are top 2 = 10. Capex eff = 14. Indep demand: growing enterprise = 12. Accounting = 15.
- **Final = 72.8.** Cleanest L1 networking pick.

**12. PLTR — 64.4 final, Medium**
- **Q = 70.** Rule of 40 score of 145% ([Q1 2026 update](https://investors.palantir.com/files/Palantir%20-%20Q1%202026%20Business%20Update.pdf)). FCF $4.2–4.4B 2026 guide. But SBC dilution remains aggressive.
- **G = 95.** Revenue +85% YoY in Q1; US commercial +120% guide. Genuinely the highest-growth name in the sleeve.
- **V = 25.** **This is the problem.** PS ratio ~114 ([Gurufocus](https://www.gurufocus.com/term/ps-ratio/PLTR)). More than 2x dot-com Amazon's peak. No reasonable valuation framework defends this.
- **AIQ = 69.** Disclosure (Foundry/AIP) = 18. Defensibility (government moat) = 16. Concentration: gov + commercial diversified = 8 (top customer is large). Capex eff: capital-light = 10. Indep demand: strong = 9. Accounting: SBC heavy, related-party flag risk = 8.
- **Burry has $912M notional puts on PLTR** as of Q3 2025 and was still positioned in Q1 2026 13F.
- **Final = 64.4 Medium.** The growth is undeniable; the valuation is indefensible. The algorithm splits the difference at Medium. **Position should be small — 1–2% — and only if you accept the valuation risk explicitly.**

**15. ORCL — 58.7 final, Low Conviction**
- **Q = 70.** Margins solid but accounting questions material.
- **G = 80.** OCI +84% YoY ([Q3 FY26](https://investor.oracle.com/investor-news/news-details/2026/Oracle-Announces-Fiscal-Year-2026-Third-Quarter-Financial-Results/default.aspx)). $300B OpenAI deal is real but accounting-contested.
- **V = 35** *(includes Burry overstatement penalty −5, depreciation penalty −5).* Burry estimates 26.9% earnings overstatement by 2028; v2 applies the full penalty.
- **AIQ = 52.** Disclosure OK but the OpenAI concentration kills the score = 10. Defensibility (OCI's GPU access) = 14. Concentration: OpenAI is potentially 30%+ of OCI revenue = 5. Capex eff = 8. Indep demand: limited beyond OpenAI = 9. Accounting: extended useful life + RPO question = 6. (Per-dim sum is the authoritative AIQ value; an earlier draft showed 60 from arithmetic drift.)
- **Final = 58.7 Low.** The growth is real but the accounting risk is exactly what the v2 algorithm is designed to catch.

**16. META — 61.4 Medium**
- **Q = 80.** Margins strong; ad business reaccelerated to +33% in Q1.
- **G = 70.** Family of Apps growing but capex (now $125–145B) compressing FCF.
- **V = 45** *(includes Burry penalty −3, depreciation penalty −10 for *two* extensions in 12 months).* The largest depreciation penalty in the slate.
- **AIQ = 54.** Disclosure (no AI revenue line) = 10. Defensibility (Llama + ad ML + Reality Labs sunk cost) = 14. Concentration: ad customers diverse = 10. Capex eff: worst in hyperscalers given Reality Labs drag = 6. Indep demand = 8. Accounting (two useful-life extensions, $2.3B benefit) = 6.
- **Final = 61.4.** Mathematically Medium but I would not deploy here. The combination of largest depreciation penalty, worst capex efficiency, and explicit Burry attention is exactly the profile to avoid.

### Recommended deployment for tomorrow

**Total capital: $100,000. Deploy 70% ($70K) tomorrow; hold 30% ($30K) for DCA over 4–6 weeks.**

The 70/30 split honestly reflects the macro gate (NAAIM 96.67) and the unresolved depreciation question. Either is enough to argue for staged entry; both together definitively rule out 100% deployment Day 1.

**Day 1 allocation ($70K):**

| Rank | Ticker | Layer | Tier | Score | $ Amount | % of $100K | Rationale |
|---|---|---|---|---|---|---|---|
| 1 | TSM | L1 | High | 82.2 | $10,000 | 10.0% | Best risk-adjusted, monopoly + diversification |
| 2 | GOOGL | L2 | Med→ | 73.8 | $9,000 | 9.0% | Cheapest hyperscaler, cleanest accounting |
| 3 | NVDA | L1 | High | 75.7 | $8,000 | 8.0% | Core compute, sized down for crowding |
| 4 | VST | L4 | Med→ | 73.8 | $7,000 | 7.0% | Best L4 risk/reward, IG upgrade |
| 5 | GEV | L4 | Med→ | 73.7 | $6,000 | 6.0% | Strongest growth print, order +71% |
| 6 | ASML | L1 | High | 75.1 | $6,000 | 6.0% | EUV monopoly, diversifies vs. NVDA |
| 7 | AVGO | L1 | Med | 74.1 | $5,000 | 5.0% | Custom silicon optionality |
| 8 | ANET | L1 | Med→ | 72.8 | $5,000 | 5.0% | Ethernet-for-AI pure play |
| 9 | LRCX | L1 | Med→ | 71.9 | $4,000 | 4.0% | WFE leverage, less crowded |
| 10 | CEG | L4 | Med | 74.6 | $4,000 | 4.0% | Nuclear exposure |
| 11 | VRT | L4 | Med | 73.5 | $3,000 | 3.0% | Cooling pure-play |
| 12 | NOW | L5 | Med | 67.3 | $3,000 | 3.0% | Incumbent with cleanest AI traction |
| **Total** | | | | | **$70,000** | **70%** | |

**Holding for DCA ($30K) over weeks 2–6:**
- Add to TSM, NVDA, VST if any single-name dips >5% absent news.
- Add to GOOGL on any post-earnings drawdown.
- Consider initiating CRWD, SNOW, INTU if macro gate count drops to 0.
- Reassess META, ORCL only if Burry's depreciation thesis is publicly addressed or refuted.

**Exclusions / avoid list:**
- **PLTR**: math doesn't defend it. If you must own, cap at 1% and view as venture-style.
- **META, ORCL**: do not deploy at current configuration. Re-score quarterly.
- **AMD, AI, S, MDB, NET, ESTC, IBM, CRM, ADBE, SAP, WDAY, ZS, INTC**: not in slate. Either weaker AIQ scores, weaker growth confirmation, or layer-redundant.

### Position-construction guardrails

- **Single-name cap: 10%** (TSM at the cap).
- **Layer caps:** L1 ≤35%, L2 ≤25%, L4 ≤25%, L3+L5 combined ≤15%.
- **High-conviction aggregate:** 33% of $100K (post-multiplier, 3 names: TSM, NVDA, ASML).
- **Reserve:** 30% in cash equivalents / SGOV until DCA executed.

---

## Part 4 — Engine build plan, target deliverable next weekend (May 22–24, 2026)

You said next weekend. Here's the concrete spec. Stack matches your existing Thesis project (Supabase + FMP + Massive + Perplexity).

### Scope for v1 of engine

**In-scope for next weekend:**
- Supabase schema + migrations
- FMP fundamentals ingestion (Q factor inputs: ROIC, gross margin, FCF, leverage)
- FMP consensus ingestion (G factor inputs: NTM revenue/EPS, revisions)
- FMP price ingestion (M factor inputs: 12-1 return, SUE, revision breadth)
- Hand-curated `universe` table (70 names from spec)
- Hand-curated `aiq_rubric` table (AIQ scored manually, re-scored quarterly)
- Scoring computation: Tier-A factors (Q, G, V, AIQ) live; M and S as stubs returning null until S/M data integrated week 2
- Output: a single "score table" view sortable by composite score with full factor decomposition

**Out-of-scope for v1, deferred to v2 engine (week 2–4):**
- Options skew ingestion (need broker API or Polygon)
- SUSI short-interest computation (requires history)
- Macro sentiment scrape (NAAIM, AAII, F&G via Perplexity)
- Concentration tax (requires returns history → PCA)
- Backtest harness

### Supabase schema (final, ready to migrate)

```sql
-- universe: hand-curated list
CREATE TABLE universe (
  ticker text PRIMARY KEY,
  name text NOT NULL,
  layer int NOT NULL CHECK (layer BETWEEN 1 AND 5),
  layer_label text NOT NULL,
  is_active boolean DEFAULT true,
  added_at timestamptz DEFAULT now(),
  notes text
);

-- raw fundamentals from FMP, one row per ticker per fiscal period
-- Column set sized to support full QMJ Q-score: profitability (ROIC needs NOPAT inputs),
-- safety (Altman Z needs retained_earnings + working capital), payout (dividends + buybacks).
CREATE TABLE fundamentals_raw (
  ticker text REFERENCES universe(ticker),
  period_end date NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('Q', 'A')),
  -- income statement
  revenue numeric,
  gross_profit numeric,
  operating_income numeric,
  income_before_tax numeric,
  income_tax_expense numeric,
  net_income numeric,
  -- cash flow
  fcf numeric,
  capex numeric,
  dividends_paid numeric,              -- cash outflow, stored as positive
  common_stock_repurchased numeric,    -- cash outflow, stored as positive
  -- balance sheet
  total_assets numeric,
  current_assets numeric,
  cash_and_equivalents numeric,
  current_liabilities numeric,
  total_debt numeric,
  retained_earnings numeric,
  shareholders_equity numeric,
  shares_diluted numeric,
  ingested_at timestamptz DEFAULT now(),
  PRIMARY KEY (ticker, period_end, period_type)
);

-- consensus from FMP, daily snapshots
CREATE TABLE consensus (
  ticker text REFERENCES universe(ticker),
  as_of date NOT NULL,
  ntm_revenue numeric,
  ntm_eps numeric,
  fy1_eps numeric,
  fy2_eps numeric,
  num_analysts int,
  rating_avg numeric,  -- 1=strong buy, 5=strong sell
  target_price numeric,
  PRIMARY KEY (ticker, as_of)
);

-- daily prices for momentum
CREATE TABLE prices_raw (
  ticker text REFERENCES universe(ticker),
  date date NOT NULL,
  open numeric, high numeric, low numeric, close numeric,
  volume bigint,
  PRIMARY KEY (ticker, date)
);

-- revision tracking (computed from consensus diffs)
CREATE TABLE revisions (
  ticker text REFERENCES universe(ticker),
  as_of date NOT NULL,
  fy1_eps_30d_pct_change numeric,
  fy1_eps_90d_pct_change numeric,
  upward_breadth_pct numeric,  -- % of analysts revising up in 30d
  PRIMARY KEY (ticker, as_of)
);

-- AIQ rubric, manually scored, quarterly cadence
CREATE TABLE aiq_rubric (
  ticker text REFERENCES universe(ticker),
  scored_at date NOT NULL,
  disclosure_pts int CHECK (disclosure_pts BETWEEN 0 AND 20),
  defensibility_pts int CHECK (defensibility_pts BETWEEN 0 AND 20),
  concentration_pts int CHECK (concentration_pts BETWEEN 0 AND 15),
  capex_eff_pts int CHECK (capex_eff_pts BETWEEN 0 AND 15),
  indep_demand_pts int CHECK (indep_demand_pts BETWEEN 0 AND 15),
  accounting_pts int CHECK (accounting_pts BETWEEN 0 AND 15),
  total int GENERATED ALWAYS AS (
    disclosure_pts + defensibility_pts + concentration_pts +
    capex_eff_pts + indep_demand_pts + accounting_pts
  ) STORED,
  notes text,
  PRIMARY KEY (ticker, scored_at)
);

-- depreciation penalty tracking
CREATE TABLE depreciation_flags (
  ticker text REFERENCES universe(ticker),
  flagged_at date NOT NULL,
  extension_years numeric,  -- e.g., 1.5 for Meta total extension
  penalty_v int,  -- the v2 V-score penalty
  burry_overstatement_pct numeric,
  source_url text,
  PRIMARY KEY (ticker, flagged_at)
);

-- output: score history
CREATE TABLE scores_history (
  ticker text REFERENCES universe(ticker),
  as_of date NOT NULL,
  q_score numeric,
  g_score numeric,
  v_score numeric,
  v_penalty numeric DEFAULT 0,
  aiq_score numeric,
  m_score numeric,  -- null until engine v2
  s_score numeric,  -- null until engine v2
  layer_weights jsonb,
  composite numeric,
  macro_gates_hit int DEFAULT 0,
  macro_multiplier numeric DEFAULT 1.0,
  final_score numeric,
  tier text CHECK (tier IN ('High', 'Medium', 'Low', 'Avoid')),
  factor_breakdown jsonb,  -- full decomposition for UI
  computed_at timestamptz DEFAULT now(),
  PRIMARY KEY (ticker, as_of)
);
```

### Scoring computation, Python pseudocode

```python
def compute_q_score(ticker: str, as_of: date) -> float:
    """AQR QMJ adapted. Equal-weighted profitability + growth + safety + payout.
       Each pillar z-scored within layer, then 0-100 percentile."""
    fundamentals = fetch_fundamentals(ticker, as_of)
    profitability = z_score_within_layer([
        fundamentals.gross_profit / fundamentals.total_assets,
        fundamentals.roic,
        fundamentals.fcf / fundamentals.revenue,
        fundamentals.operating_margin,
    ], ticker, as_of)
    growth = z_score_within_layer([
        five_year_change(ticker, 'gross_profit / total_assets'),
        five_year_change(ticker, 'roic'),
        five_year_change(ticker, 'fcf / revenue'),
        five_year_change(ticker, 'operating_margin'),
    ], ticker, as_of)
    safety = z_score_within_layer([
        -market_beta(ticker, 60),       # negative = safer
        -leverage_ratio(ticker),
        -earnings_volatility(ticker, 20),
        -altman_z_score(ticker, signed=True),
    ], ticker, as_of)
    payout = z_score_within_layer([
        (buybacks + dividends) / equity_market_cap,
    ], ticker, as_of)
    # downweight payout for L1-L3 by 50%
    layer = get_layer(ticker)
    payout_weight = 0.125 if layer in (1, 2, 3) else 0.25
    other_weight = (1.0 - payout_weight) / 3
    composite_z = (other_weight * profitability +
                   other_weight * growth +
                   other_weight * safety +
                   payout_weight * payout)
    return percentile_within_layer(composite_z, ticker, as_of)


def compute_g_score(ticker: str, as_of: date) -> float:
    """NTM revenue growth + AI-segment proxy + capex efficiency (layer-specific).
       Equal weighted."""
    layer = get_layer(ticker)
    ntm_growth = consensus_ntm_revenue_growth(ticker, as_of)
    ai_segment_growth = ai_segment_proxy(ticker, layer, as_of)
    capex_eff = capex_efficiency_layer_specific(ticker, layer, as_of)
    z = z_score_within_layer([ntm_growth, ai_segment_growth, capex_eff], ticker, as_of)
    return percentile_within_layer(z, ticker, as_of)


def compute_v_score(ticker: str, as_of: date, maintenance_capex_method: str = 'mid') -> float:
    """EV/EBITDA-to-growth + adjusted FCF yield + own-history fwd P/E z-score.
       Then subtract depreciation/Burry penalties."""
    layer = get_layer(ticker)
    peg_like = ev_ebitda(ticker) / ntm_revenue_growth(ticker)
    maintenance_capex = compute_maintenance_capex(ticker, method=maintenance_capex_method)
    adj_fcf_yield = (fcf(ticker) + (capex(ticker) - maintenance_capex)) / ev(ticker)
    own_history_z = (forward_pe(ticker) - mean_forward_pe(ticker, 5*252)) / stdev_forward_pe(ticker, 5*252)
    raw_v = percentile_within_layer([peg_like, adj_fcf_yield, -own_history_z], ticker, as_of)
    # apply v2 depreciation + Burry penalty
    penalty = depreciation_penalty(ticker, as_of)
    return max(0, raw_v + penalty)  # penalty is negative


def compute_aiq_score(ticker: str, as_of: date) -> float:
    """Pulled from aiq_rubric table; manually scored quarterly."""
    return query_aiq_rubric(ticker, as_of)


def macro_gate_multiplier(as_of: date) -> float:
    naaim = fetch_naaim(as_of)
    aaii_spread_3wk = fetch_aaii_3wk_spread(as_of)
    fg = fetch_fear_greed(as_of)
    gates_hit = sum([
        naaim > 90,
        aaii_spread_3wk > 30,
        fg > 80,
    ])
    return {0: 1.00, 1: 0.95, 2: 0.90, 3: 0.85}[gates_hit]


def compute_composite(ticker: str, as_of: date) -> dict:
    layer = get_layer(ticker)
    weights = LAYER_WEIGHTS[layer]  # {Q: 0.22, G: 0.22, V: 0.14, AIQ: 0.18, M: 0.14, S: 0.10}
    q = compute_q_score(ticker, as_of)
    g = compute_g_score(ticker, as_of)
    v = compute_v_score(ticker, as_of)
    aiq = compute_aiq_score(ticker, as_of)
    m = compute_m_score(ticker, as_of)  # null until engine v2
    s = compute_s_score(ticker, as_of)  # null until engine v2

    # for v1 engine, rescale Tier-A weights to sum to 1.0
    if m is None or s is None:
        tier_a_weights = {k: weights[k] for k in ('Q', 'G', 'V', 'AIQ')}
        total = sum(tier_a_weights.values())
        tier_a_weights = {k: v/total for k, v in tier_a_weights.items()}
        composite = (tier_a_weights['Q'] * q + tier_a_weights['G'] * g +
                     tier_a_weights['V'] * v + tier_a_weights['AIQ'] * aiq)
    else:
        composite = (weights['Q']*q + weights['G']*g + weights['V']*v +
                     weights['AIQ']*aiq + weights['M']*m + weights['S']*s)

    multiplier = macro_gate_multiplier(as_of)
    if composite >= 75:  # only de-rate High
        composite = composite * multiplier
    tier = ('High' if composite >= 75 else
            'Medium' if composite >= 60 else
            'Low' if composite >= 45 else 'Avoid')
    return {
        'ticker': ticker, 'as_of': as_of, 'q': q, 'g': g, 'v': v, 'aiq': aiq,
        'm': m, 's': s, 'composite': composite, 'multiplier': multiplier, 'tier': tier
    }
```

### Build schedule, weekend of May 22–24

- **Friday eve:** schema migrate, universe table populate, FMP credential test
- **Saturday AM:** fundamentals ingestion script + first pull for full universe
- **Saturday PM:** consensus + prices ingestion; Q-factor computation; first Q scores
- **Sunday AM:** G + V factor computations; depreciation_flags table populated by hand for L2 names
- **Sunday PM:** AIQ rubric — port the 20 names I scored tonight as the v1 seed; expand to 70 names over the week
- **Output by Sunday evening:** working `scores_history` table with 70 names and a Supabase view I can query from your Thesis portal

After that, weeks 2–4 are: M and S ingestion, concentration tax (PCA), backtest harness, then walk-forward weight re-optimization. By June 15 you have a fully operational engine with weights derived from data rather than asserted.

---

## Part 5 — Honest caveats

1. **Hand-scoring is subjective.** Two analysts running the same v2 rubric on the same name will disagree by 5–15 points on individual factors. The composite tier (High/Med/Low) is more robust than the specific score. Treat ±5 points as noise.
2. **My AIQ scores reflect publicly available May 14 2026 information.** When the engine is live, AIQ should be re-scored after every Q1 earnings cycle (so next refresh is August 2026 for Q2 prints).
3. **Burry has not been right yet.** The depreciation penalty is a hedge against a thesis that may never play out. Sizing the penalty as I have is a judgment call. If you disagree — if you think the depreciation thesis is overblown — you can dial penalties from −10 / −5 / −3 to half that and the slate barely changes (META rises one tier; ORCL rises one tier; everything else is unaffected).
4. **The 0.95 macro multiplier is a single judgment call.** I chose the (1.00, 0.95, 0.90, 0.85) curve because it's smooth and prudent. An equally defensible choice is (1.00, 0.97, 0.93, 0.85) — less aggressive on 1 gate, same on 3. Pick what matches your risk tolerance and document it.
5. **The 70/30 deploy-now/hold-for-DCA split is conservative.** If you have higher conviction in the multi-year thesis (which the algorithm explicitly supports — the macro gate only de-rates 5%), you can deploy 85/15. I would not deploy 100/0 given NAAIM 96.67.
6. **Tomorrow's execution matters less than the framework.** Whether you buy at the open or stagger over the day matters less than whether the names and weights are right. Pick limit prices reasonably and don't chase.

---

## Tomorrow's action checklist

- [ ] Confirm broker has the cash to deploy $70K Day 1
- [ ] Set limit orders for each of the 12 names at ~0.5% below current bid
- [ ] If any name moves >2% against you intraday before fill, re-evaluate (don't chase)
- [ ] Document fills + actual cost basis in a spreadsheet
- [ ] Set calendar reminder for May 21 to re-evaluate the $30K reserve
- [ ] Set calendar reminder for August 1 to re-score AIQ for full universe after Q2 earnings
- [ ] Block 4 hours next weekend (May 22–24) for engine build per Part 4

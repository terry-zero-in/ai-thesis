# What Leads What: NEAR and the Kalshi 15-Minute Crypto Markets

**Research report · 2026-08-15 · companion to the Lead-Lag Radar tool (`index.html`)**

Every claim is tagged: **[verified]** = a primary document was read this session
(Kalshi's vendored OpenAPI/AsyncAPI specs, production bot repos);
**[reported]** = search-result/secondary-source evidence (this session's
sandbox blocked direct page fetches, so most external claims are this grade);
**[inferred]** = reasoned synthesis. Where it matters, treat [reported] numbers
as working ranges, and let the tool's TRUTH tab replace them with your own
measured numbers — that is what it is for.

---

## 1. The mechanism — why a few-second jump exists at all

The settlement chain for **all nine** Kalshi 15-minute crypto markets:

```
Binance perp / Hyperliquid          ← price discovery happens here first
        ↓  ~1–10 seconds
Coinbase, Kraken, Bitstamp, Gemini, Crypto.com   ← CF index constituents react
        ↓  1 Hz
CF Benchmarks Real-Time Index       ← order-book mid of constituents only
        ↓  averaged
Kalshi settlement = mean of the final 60 one-per-second index prints
        ↘
Kalshi order book                   ← quotes lag everything above; alt books thin
```

Load-bearing facts:

- **Settlement rule [verified — Kalshi AsyncAPI/OpenAPI specs + market rule
  text]:** each market resolves YES if the *simple average of 60 once-per-second
  CF Benchmarks Real-Time Index values over the final minute* is **at least**
  the target. Window is (close−60s, close]. A move in the last k seconds only
  enters settlement with weight k/60 — late jumps are diluted.
- **Strike chaining [reported — kalshibacktest.com, confirmed in bot code]:**
  the target is the *previous* window's 60-second settlement average. Window
  N's settlement print is window N+1's strike. (The Radar exploits this: it
  seeds each session's strike from its own settlement accumulator.)
- **Index methodology [reported — CME CF methodology docs]:** RTIs are computed
  once per second as the mid implied by the *consolidated order book* of
  constituent exchanges — books, not trades. Constituents are exclusively
  regulated USD venues: Coinbase, Kraken, Bitstamp, Gemini (+ LMAX, Bullish,
  Crypto.com depending on index). **Binance, Bybit, OKX, and all perp venues
  are never constituents.**
- **Sources per asset [reported — cfbenchmarks.com index pages]:** BTC → BRTI;
  ETH → ETHUSD_RTI; SOL → SOLUSD_RTI; XRP → XRPUSD_RTI; DOGE → DOGEUSD_RTI;
  BNB → BNBUSD_RTI; NEAR → NEARUSD_RTI (added to the CME CF RTI methodology
  29-Dec-2025); ZEC → CF Zcash-Dollar rate; HYPE → CF Hyperliquid-Dollar rate
  (published from 20-Apr-2026; its index id may carry a `U_` prefix, and
  Hyperliquid itself is plausibly a pricing venue for HYPE).
- **Venue lag numbers:** an SEC/NYSE-Arca filing exhibit measured **Coinbase
  leading Kraken by ~1.4s**, with low-volume venues lagging high-volume ones
  [reported]; a practitioner site estimates the **index lags leading venues by
  ~10s during fast moves** [reported — single low-reliability source; treat
  5–15s as the working range]. Academic venue studies put cross-exchange lags
  at up to ~15s [reported].

The structural conclusion [inferred, but each link documented]: **everything
that determines settlement is observable seconds before it becomes
settlement.** The perp tape tells you what the constituents will do; the
constituents tell you what the index will do; the index accumulates into the
settlement average at a known rate. The Radar watches all three layers.

## 2. Existence proof — this exact trade has been done, at scale

- The best-documented case turned **$313 into ~$414–438K in one month at a 98%
  win rate over 6,615 trades**, exclusively in Polymarket's BTC/ETH/SOL
  15-minute up/down markets — buying when the underlying's move had already
  made the true probability ~85% while the binary still quoted ~50–70¢
  [reported — press coverage of on-chain records].
- An AFT 2025 paper (arXiv:2508.03474) quantified **~$40M extracted from
  Polymarket in one year**; 41% of markets exhibited arbitrage; the edge was
  *execution speed, not prediction* [reported].
- Dai, Jia & Yu (Stanford/SMU, 2026): in Polymarket 5-minute BTC contracts,
  Binance net order flow jumped ~50% in the final 10 seconds of flagged
  cycles; 821 wallets captured ~$8.2M [reported].
- **Polymarket's response** (2026): dynamic taker fees peaking ~3.15% at 50¢ —
  aimed exactly at near-50/50 latency arbitrage — and a switch to Chainlink
  TWAP settlement (60s TWAP for 15-min markets, effective 2026-08-07)
  [reported].
- **Kalshi's current state:** flat `ceil(0.07·P·(1−P))` taker fee (≈1.75¢ at
  50¢, ≈0.6¢ at 10¢/90¢) on all nine crypto 15M series [reported — fee configs
  in production repos; formula verified in spec], plus the 60s-average
  settlement it always had. **No Polymarket-style anti-latency fee found on
  Kalshi as of this research.** No academic study measures Kalshi 15M
  staleness yet — the thin alt binaries you trade are the least-studied,
  slowest corner of this ecosystem [inferred].

Sizing reality check: those Polymarket bots clipped $4–5K per trade in BTC/ETH
markets with deep books. Kalshi's **alt** 15M books run **under $2K volume per
market** (your screenshots: NEAR ~$1,021, ZEC ~$99, BNB ~$519, HYPE ~$768).
The mispricings should be *larger and live longer* there, but fills are small
and the spread is part of the toll. The edge threshold in the Radar defaults
to 4¢ after fees for exactly this reason.

## 3. NEAR specifically

**Identity (2026): NEAR trades as an AI/agents-basket name.** The basket:
FET, TAO, RENDER, ICP, INJ, VIRTUAL. Sector moves are lockstep on AI/Nvidia
catalysts; in Q1 2026 AI tokens were the only sector that outperformed
[reported — Cointelegraph, sector trackers]. Two implications:

1. The basket is a *context* signal for NEAR — when the AI basket runs and
   NEAR hasn't moved yet, NEAR is the laggard to buy on Kalshi.
2. **Caution:** NEAR has repeatedly *led* this basket (Jan 2026: +32%/24h;
   May 2026: +50%/wk leading the rally) [reported]. So basket→NEAR is not a
   one-way street. The Radar logs `basket` signals and grades them in TRUTH —
   trust the measured hit rate, not the narrative.

**Where NEAR's price is made:** the Binance NEARUSDT perp+spot complex
[reported — volume snapshots ~$298M/24h spot; perp OI peaked ~$396M Oct 2025;
inferred for discovery]. Perps lead spot across crypto (~93% of futures
volume; Binance BTC perp:spot ≈ 6:1) [reported]. A 26-exchange Granger study
(Nov 2025–Jan 2026) found **mid-tier venues (Bybit/OKX/Hyperliquid) lead
Binance more often than the reverse** [reported] — so a *consensus of fast
venues* beats any single tape. The Radar's leader lane (Hyperliquid allMids +
optional Binance) is that consensus, and the Hyperliquid feed is the one
that's always reachable from a US browser without keys.

**How fast NEAR follows BTC:** no NEAR-named tick study exists. Bounds from
the literature [reported→inferred]: cross-venue arb runs ≤15s; small-caps peak
correlation at ~1-minute lag; BTC led ADA (a comparable mid-cap) by 16–118s,
avg ~57s in 2019–21 with the lead *shrinking* over time. Working estimate:
**NEAR lags a BTC impulse by seconds to tens of seconds** — and the Radar
measures the actual number live in the MATRIX tab rather than trusting this
range.

**Beta/correlation:** NEAR–ETH 3-month correlation ~0.87 [reported —
Macroaxis Aug 2026]; secondary L1-basket beta (SOL/AVAX/APT/SUI). High beta =
big moves per BTC impulse = more 15-minute windows where the strike gets
crossed.

**Korea:** Upbit+Bithumb ≈ 96% of Korean volume, but Korean flow is a
*lagging/amplifying* retail gauge for NEAR, with a small reverse premium in
2026 — not a leading indicator worth engineering for [reported/inferred].

**Idiosyncratic drivers (correlation breakers):** inflation halved to 2.5%
(Oct 30, 2025, nearcore v2.9.0 — staking yield ~4.5%); sharding/perf upgrades
(600ms blocks May 2025; dynamic resharding June 2026); AI-agents product news;
token unlocks. Mid-Aug 2026 state: ~$1.63, below major EMAs, daily RSI ~38,
30-day vol 6.8–8.4%, intraday ranges compressed [reported]. When a NEAR-native
headline lands, the BTC-lag model is the wrong model — that is what the
impulse log's `self` rows and per-asset TRUTH stats will show.

## 4. All nine, ranked for this trade

The research composite ranks by: (a) how far the Kalshi book lags a watchable
leader, (b) leader reliability, (c) tradeable-impulse frequency, (d) fill
capacity/spread cost. Scores below are [a/b/c/d], 1–5. [inferred — judgment
ranking over reported data; the MATRIX tab replaces these priors with live
measurements, and TRUTH replaces them with your own hit rates.]

| rank | asset | scores | the watchable leader(s) | the story |
|---|---|---|---|---|
| 1 | **XRP** | 4/4/4/4 | Binance XRPUSDT perp **+ Upbit XRP/KRW** (Asian hours) + BTC (30d corr 0.84) | Uniquely *dual* out-of-index discovery: Upbit holds ~14.4% of world XRP volume (> Binance's ~12%; XRP/KRW is Upbit's #1 market at ~$111M/day) and **neither venue is an index constituent**. Price sits on the $1.00 round number → strikes cluster where defense/liquidation flow concentrates. |
| 2 | **SOL** | 4/4/4/4 | Binance SOLUSDT perp + BTC (0.86) | Perp leads the 5-venue index; ~$1.8B leveraged OI around $78 generates cascade impulses; scheduled upgrade catalysts (Agave v4.2 week of Aug 17, Alpenglow Aug–Oct). A hair behind XRP only for lacking the second (Korean) leader. |
| 3 | **BNB** | 5/5/2/2 | Binance BNBUSDT itself (same-asset arb) | **Cleanest structural lag in the set**: the CF BNB index settling Kalshi reads exactly two young, thin books — Coinbase (~Nov 2025) and Kraken (Apr 2025) — that mechanically chase Binance-native discovery. Near-zero bot competition at ~$519/market. Caps: low vol → few impulses; thin book → small size. BSC upgrade Aug 25 (~02:30 UTC) suspends deposits/withdrawals — dislocations may *widen* that window. |
| 4 | **ZEC** | 5/4/5/1 | Binance ZECUSDT perp (whale prints, liquidations) + privacy-narrative headlines | An 18:1 derivatives-to-spot ratio ($2.1B/day perp vs ~$49M total spot) — a huge tail wags a tiny spot dog, and the index reads only Coinbase+Gemini+Kraken spot. **Currently ~−0.78 correlation to BTC** — a pure idiosyncratic name; BTC impulses are the *wrong* signal for ZEC right now. Fillability 1/5 (~$99/market) — highest per-contract edge, smallest size. |
| 5 | **DOGE** | — | BTC (90d corr 0.65–0.82) + Musk/X headline feed | Binance leads ($581M of $1.3B perp OI). X Money integration headlines are instant DOGE-specific impulses (+7% intraday on one Musk post). |
| 6 | **ETH** | — | BTC (0.94), Binance ETH perp; CME/ETF only 9:30–16:00 ET | Binance overtook CME in ETH OI (Dec 2025). Deep and fast → fewer stale quotes. Glamsterdam fork headlines (target end-Aug 2026) both ways. |
| 7 | **NEAR** | — | BTC/ETH impulse + AI basket + Binance NEAR perp | Solid seconds-to-tens-of-seconds BTC laggard with clean basket context (§3) — but mid-pack on impulse frequency and fill capacity in the composite. For *your* NEAR focus: the lag edge is real; size to the ~$1K book. |
| 8 | **HYPE** | — | Hyperliquid's own book (nothing external leads it) | +147–180% YTD while BTC fell 27% — fully decoupled from BTC in 2026 [reported — Bloomberg]. The CF HYPE index is new (Apr 2026) and Hyperliquid itself is plausibly a pricing venue → the chain you'd front-run is short or nonexistent. Trade HYPE on the fair-value model, not on cross-asset lead-lag. |
| 9 | **BTC** | — | CME futures (led Binance spot by ~55ms in a 2024 sample), ETFs in RTH | $114K/market book with automated MMs watching the CF feed — the lane is contested (public bots exist, e.g. `brandononchain/kalshibot`). Residual edge lives in the **settlement-window math**, not latency. |

Cross-asset correlation regime (30-day, Apr 2026 snapshot [reported]):
BTC–ETH 0.94, BTC–SOL 0.86, BTC–XRP 0.84, SOL–XRP 0.91 — majors cluster
0.7–0.95 in risk regimes. The standing exceptions: **ZEC (−0.78)** and
**HYPE (decoupled)** — for those two, the BTC-impulse lane is off; the
fair-value and idiosyncratic-momentum lanes still apply.

Kalshi book microstructure [reported]: spreads are widest in the first ~5
minutes of each window, tightest mid-window, and widen again late as books
thin — so late-window entries pay maximum spread exactly when signals are
strongest. Best execution is mid-window; the final 90 seconds are for the
settlement-average game, where the Radar computes the locked-in portion of
the TWAP live (a leader move in the last 30s only ~half-counts).

BTC's special case: the liquid book means fewer stale quotes, but the
**final-minute settlement game** (accumulated average vs strike) is still
playable there because it's math, not latency.

## 5. How the tool turns this into practice

| research fact | tool feature |
|---|---|
| index = order-book mid of Coinbase/Kraken/etc. | settle proxy = median of CB+KR **bid/ask mids** (constituents), not trades |
| discovery on HL/Binance perps, never constituents | leader lane streams HL `allMids` (+ Binance optional), impulses z-scored on the leader tape |
| BTC→alt lag is seconds and asset-specific | live cross-correlation per asset (MATRIX), ghost overlay shifted by the measured lag (RADAR) |
| settlement = 60s average, late moves weighted k/60 | fair prob uses the averaging-window variance math; inside the window it accumulates the *observed* running average |
| strike = previous window's settlement average | strikes auto-seed at every roll from the tool's own accumulator |
| fees = ceil(0.07·P·(1−P)) | EV per side shown after fees; edge signals require +4¢ after fees by default |
| 98%-win bots existed because they *graded themselves* | every signal is logged, resolved against the same rule Kalshi uses, and calibrated in TRUTH (bands, Wilson CIs, Brier) |
| Kalshi REST has no CORS | bundled `tools/kalshi-proxy.mjs` (40 lines, GET-only) auto-fills strikes + prices |

**The loop Terry runs:** open the Radar next to Kalshi → watch NEAR (or the
MATRIX's currently-laggiest asset) → when a leader impulse fires or the model
diverges ≥4¢ from the Kalshi quote, the signal logs itself → trade or don't →
after a few sessions, open TRUTH and see which signal kinds, strengths, and
assets actually hit → tighten thresholds, size the ones that calibrate, kill
the ones that don't.

## 6. Honest limitations

1. **Most external claims are [reported]**, not page-verified — this session's
   sandbox blocked direct fetches of kalshi.com, cfbenchmarks.com, arXiv, SSRN
   and every exchange API. The two highest-stakes engineering facts (series
   tickers, settlement rule/WS schema) were **[verified]** against Kalshi's
   own API specs vendored in public repos. Feed symbol maps ship as best-known
   config; the tool's status lights and venue grid make any wrong entry
   visible in seconds rather than silently wrong.
2. **Lead-lag decays.** The ADA lead shrank over 2019–21; leads compress every
   year; Polymarket's countermeasures show platforms adapt. The tool assumes
   nothing is stationary — that's why calibration is a first-class tab, not a
   footnote.
3. **Thin books cut both ways.** Stale quotes are the edge; getting filled at
   them, against the spread, minus 1–2¢ of fees, is the cost. EV math in the
   tool is after-fee; it is not after-spread on *your* fill — watch your own
   realized results in TRUTH's edge bands.
4. **The proxy is 2 of ~5 constituents.** CB+KR median tracks the index to a
   few bps — fine for direction and ≥4¢ edges, not for 1¢ disputes at the
   strike. When it's that close, the answer is "no trade."

## 7. Sources (principal)

- Kalshi API specs (OpenAPI 3.13.0 / AsyncAPI 2.0.0, vendored in
  `texascoding/kalshi-python-sdk`, `reedjacobp/kalshi-trading-bot`) — series
  tickers, settlement rule, WS channels incl. `cfbenchmarks_value`, order and
  candlestick schemas. **[verified]**
- CME CF Real Time Indices methodology + constituent-exchange PDFs
  (docs.cfbenchmarks.com); cfbenchmarks.com index pages for
  BRTI/ETHUSD_RTI/SOLUSD_RTI/XRPUSD_RTI/DOGEUSD_RTI/BNBUSD_RTI/NEARUSD_RTI,
  ZEC and HYPE additions. [reported]
- kalshibacktest.com — settlement mechanics, strike chaining, ~10s index lag
  estimate. [reported]
- Springer *Asia-Pacific Financial Markets* 2026 — BTC→alt high-frequency
  Granger causality, liquidity-sorted lags, lag-trading strategy. [reported]
- *Investment Management and Financial Innovations* 2023 — BTC led ADA by
  16–118s (avg ~57s). [reported]
- Alexander & Heck (J. Financial Stability 2020); Kapar & Olmo 2019; arXiv
  2506.08718; *Finance Research Letters* 2026 sub-second study — perp/futures
  dominance in price discovery. [reported]
- SSRN 4983566 (Cosenza & Stalder) + Kaiko Research — venue leadership,
  Binance share decline, Hyperliquid rise. [reported]
- SEC/NYSE-Arca 34-93445 exhibit — Coinbase-leads-Kraken ~1.4s and venue
  ordering. [reported]
- arXiv 2508.03474 (AFT 2025) — $40M Polymarket arbitrage. [reported]
- Dai, Jia & Yu (Stanford/SMU 2026) — settlement manipulation, final-10s
  order-flow bursts. [reported]
- Press coverage of the $313→$414K Polymarket latency bot; Polymarket dynamic
  fee + Chainlink TWAP changes (Jan/Aug 2026). [reported]
- `txbabaxyz/polyrec` — prior-art dashboard for the Polymarket version of this
  trade. [reported]
- NEAR: Cointelegraph AI-rally coverage, Nansen NEAR Q2 2026 report, The
  Defiant (inflation halving), Macroaxis correlation, Coinglass/FXStreet OI,
  CoinDesk (Bithumb suspension). [reported]

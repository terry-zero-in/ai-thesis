# Lead-Lag Radar

Real-time lead-lag instrument for Kalshi's nine 15-minute crypto up/down markets
(BTC, ETH, SOL, XRP, DOGE, NEAR, BNB, ZEC, HYPE). Watches the venues that
mechanically determine settlement, measures who leads whom live, prices the
binary fairly, and grades every signal it ever fires so you can calibrate
trust before risking money on it.

**Open `index.html` in a browser. That's it.** No server, no install, no build.

```
index.html?sim=1          offline demo on a deterministic synthetic feed
index.html?sim=1&warp=900 same, with 15 minutes of tape pre-filled (instant warm)
index.html?selftest=1     in-browser engine assertions → console
```

Companion research: `RESEARCH.md` (what leads each asset and why, with sources).

## The mechanism this tool exploits

Kalshi's crypto 15-minute markets settle on the **simple average of 60
one-per-second CF Benchmarks Real-Time Index values over the final minute**
before the quarter-hour, and the index is computed from named constituent spot
exchanges — **Coinbase, Kraken, Bitstamp, Gemini, Crypto.com** for the
alt-coin indices. Price discovery, however, happens on perp venues (Binance,
Hyperliquid) seconds earlier, and BTC impulses propagate to alt prices with
lags that grow as liquidity shrinks. The chain is:

```
perp tape (leads) → constituent spot exchanges → CF index → Kalshi settlement
                                                    ↘ slow/thin Kalshi book
```

Everything on the left of the arrow is watchable in real time from a browser.
The Radar streams it, measures each link's lag live, and compares its own
fair probability against the Kalshi quote you type in (or auto-poll).

## Panels

- **RADAR** — the focus asset. Ghost chart (leader trace time-shifted by the
  live measured lag and overlaid on the asset — when the ghost traces the
  asset, the lead is real *right now*); live cross-correlation by lag;
  fair-value vs Kalshi with after-fee EV per side; impulse strip.
- **MATRIX** — all nine assets: how many seconds each lags BTC and ETH, the
  leader-vs-settle-proxy lag, current σ. Basket drift (AI basket vs NEAR etc).
- **LOG** — every signal fired, with outcome once resolved. CSV export.
- **TRUTH** — the calibration loop. Hit rates by signal kind, by impulse
  strength, by displayed probability band (edge signals), per asset, with
  Wilson 95% intervals and Brier score. If displayed 80¢ doesn't hit ~80%,
  you'll see it here before it costs you.

## Signals (all logged, all graded)

| kind | fires when | predicts | resolved against |
|---|---|---|---|
| `impulse` | leader tape moves ≥ zσ in 3s/10s | followers with significant lag move same direction | spot composite after horizon |
| `edge` | \|model − market\| ≥ threshold after fees | settlement side | 60s settlement average (same rule as Kalshi) |
| `basket` | basket 60s return diverges ≥ zσ from asset | asset catches up | spot composite after 60s |

Fees use Kalshi's schedule: `ceil(0.07 · P · (1−P))` per contract.

## Feeds

| light | source | role |
|---|---|---|
| HL | Hyperliquid WS `allMids` (public, US-reachable) | leader tape for all 9 + basket coins (FET/TAO/RENDER/ICP/AVAX/APT/SUI) |
| CB | Coinbase Exchange WS ticker (public) | settlement-index constituent |
| KR | Kraken WS v2 ticker (public) | settlement-index constituent |
| BN | Binance WS aggTrade (optional) | extra leader tape — geo-dependent; fails soft |
| KALSHI | REST poll via bundled proxy | strike + yes/no auto-fill |

The settle proxy per asset is the **median of fresh constituent feeds**
(CB+KR default; BNB/HYPE fall back to venues that actually list them). Every
feed auto-reconnects with backoff; lights go amber when stale (>6s), red when
down. The tool never fabricates data across gaps — a dead feed shrinks the
sample, it doesn't poison σ.

### Kalshi auto-fill (optional)

Kalshi's REST is public but sends no CORS headers, so a browser page cannot
call it directly. Run the bundled 40-line proxy (GET, market-data paths only):

```
node tools/kalshi-proxy.mjs
```

Enable "poll Kalshi REST" in settings; the poller tries direct first, then
`localhost:8787` automatically. Without it, type the strike and yes price from
the Kalshi card — two numbers per 15 minutes.

## Verification

```
node tools/behaviour.mjs     # 63 assertions, zero deps, run from anywhere
```

Extracts the engine block out of `index.html` (single source of truth — no
duplicated code to drift) and drives it in Node: settlement-average variance
math vs 20k-path Monte Carlo, xcorr recovering known lags end-to-end through
the sim, per-second sampling discipline, winsorized σ, fee/edge arithmetic,
signal lifecycle, calibration tables, CSV shape.

## Design debts inherited from `btc-session-edge-v3`

Its HANDOFF.md documents defect classes that all biased toward false
confidence. This tool is built against them:

1. **Cached polls logged as fresh reads** (σ collapse → fake certainty) →
   WebSocket-first; σ samples one close per wall-second, consecutive seconds
   only; gaps never fabricate returns.
2. **Shadow pipeline ≠ live pipeline** (calibration validated the wrong code
   path) → one signal log, one resolver, one scorer; TRUTH reads the same
   records the panels displayed.
3. **Settlement-average variance hacks** (non-monotonic minute-14 factor) →
   the running observed average is accumulated once inside the window, which
   makes remaining variance `σ²·w·(1−f)³/3` — monotonic to zero, and verified
   against Monte Carlo in the tests.

## Honest limits

- Lag resolution is 1 second (per-second return grid). The impulse detector
  reacts sub-second off the raw tick tape, but measured lags are integers.
- The CB+KR median is a *proxy* for the CF index (2 of ~5 constituents),
  good to a few basis points — fine for direction and for edge ≥ 4¢, not for
  settling a 0.5¢ dispute.
- Browser wall-clock sets the session boundary. Keep your machine's clock
  synced (macOS does by default); a 2s skew distorts the final-minute math.
- In-browser xcorr is correlation, not causation — the TRUTH tab exists
  precisely because a measured lag can decay. Trust the hit rates, not the
  vibe.

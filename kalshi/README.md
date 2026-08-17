# Kalshi Weather — paper-mode distributional pricing system

**Status: PAPER MODE ONLY. There is no live-trading code path in this package,
no credentials, and no flag to enable one** — `tests/test_gate_containment.py`
enforces that structurally. Built 2026-08-17 per Terry's scope.

## Edge thesis (durable context)

Distributional-vs-point mispricing in thin, rule-settled markets, harvested
maker-side. Kalshi daily-high-temperature buckets are priced by participants
reasoning from point forecasts ("the app says 86"); a bias-corrected
multi-model ensemble (31 GEFS + 51 ECMWF members) prices the whole
distribution. Where the distribution and the point-consensus disagree, we rest
maker limit orders on the cheap side of the book — tails preferred, because
Kalshi's quadratic fee (`0.07 x C x P x (1-P)`) is smallest there — and let
settlement arbitrate. The Lead-Lag Radar regime classifier is reused strictly
as a **quote/pull filter**, never a directional signal.

## The calibration gate (doctrine)

> 30-day paper Brier must beat market-implied after fees before any live-mode
> flag exists in the codebase. No auto-execute path in v1. — Terry, 2026-08-17

`gate.py` PASSES only when ALL hold on settled paper fills:
1. ≥ 30 days elapsed since the first fill,
2. ≥ 20 settled fills,
3. mean Brier of our model P < mean Brier of market-implied P (scored at
   trade time, same fills),
4. paper PnL after modeled maker fees > 0.

A PASS changes nothing in this code. It earns a conversation with Terry about
designing a live mode, which intentionally does not exist here.

## Modules

| Module | Job |
|---|---|
| `kalshi_api.py` | Public, unauthenticated Kalshi market data (series/events/markets/orderbook/trades). Read-only by construction. |
| `openmeteo.py` | GFS + ECMWF ensemble members per station (Open-Meteo ensemble API). |
| `settlement.py` | NWS daily-climate (CLI) highs via the Iowa Mesonet archive — settlement truth for calibration. |
| `bias.py` | Per-(station, lead) EMOS-lite: median debias + spread-aware kernel bandwidth; refits itself from the ledger every `settle`. |
| `pricing.py` | Corrected members → P(bucket) for less/between/greater strikes; confidence = GEFS-vs-ECMWF agreement. |
| `fees.py` | Quadratic fee model; every edge calc routes through it. |
| `sizing.py` | Quarter-Kelly (closed form proven against brute-force E[log W] in tests), $100/market cap. |
| `rules_scanner.py` | Rulebook ingestion: structural extraction + hash-based change detection + optional LLM pass; >5pt headline/rule divergences and rule changes land in the review queue. |
| `shadow.py` | Maker-only paper quotes; conservative queue-aware fill simulation from the public tape; cancel/expire maintenance. |
| `ledger.py` | sqlite record of every forecast, quote, fill, settlement, and scan. |
| `gate.py` | The doctrine above, as code. |
| `regime.py` | Quote/pull filter reading `data/regime.json` (Lead-Lag Radar export). |

## Runbook

```
python3 -m kalshi_weather discover   # list KXHIGH series; mapped vs unmapped
python3 -m kalshi_weather cycle      # price + scan + place/refresh paper quotes
python3 -m kalshi_weather settle     # pull actuals + market results; refit bias
python3 -m kalshi_weather report     # gate status, PnL, review queue
python3 -m kalshi_weather quotes     # recent paper quotes
python3 -m kalshi_weather scan       # rules scan only
```

Zero third-party dependencies (pure stdlib, Python ≥3.11). Tests:
`python3 -m unittest discover -s tests` (97 tests).

Suggested cadence once adopted (not installed by this build): `cycle` hourly
06:00–12:00 local-ish, `settle` once daily ~09:00 ET. The 30-day gate clock
starts at the first fill after adoption.

Optional LLM pass for the rules scanner: `pip install anthropic` and set
`ANTHROPIC_API_KEY`. Model defaults to `claude-opus-5`
(`KALSHI_LLM_MODEL` to override). Without a key, scans queue as
`pending_llm` — structural extraction and change detection still run.

## Known limitations and provenance (read before trusting numbers)

- **Settlement source changed 2026-08-14** — three days before this build —
  from NWS to The Weather Company (announced in series
  `product_metadata.important_info`; TWC "utilizes NWS as its primary
  underlying source", official values at weather.com/kalshi). Calibration
  uses the NWS CLI archive (the only queryable history); any TWC/NWS
  divergence is a settlement risk the scanner flags and the paper record
  will expose. This event is also live proof of why the rules-scanner exists.
- **Maker fee fraction (~25% of taker) is Terry-pinned, not verified live**
  (the fee-schedule PDF rate-limited during the build). Taker formula shape
  is corroborated by series metadata (`fee_type: "quadratic"`).
  Override: `KALSHI_MAKER_FRACTION`.
- **Bias correction starts uncalibrated.** Open-Meteo's free archive keeps
  perturbed ensemble members only ~5 days back, so there is no deep
  reforecast history to bootstrap from. The system starts with wide priors
  (3.0°F + 0.8°F/day bandwidth) and refits nightly from its own logged
  forecast-vs-settlement pairs. Expect early quotes to be wide/naive; that
  is what the 30-day window is for.
- **Lead-0 quoting stops at local noon** (`lead0_cutoff_hour_local`): by
  afternoon the market scores the observed running high against our
  forecast-only model — quoting into that is adverse selection. Pricing and
  forecast logging continue all day.
- **Regime filter is permissive-by-default** until a Lead-Lag Radar session
  (separate repo) writes `data/regime.json` (`{"state": ..., "asof": ...}`).
  Interface only — this package never reaches into that repo.
- **Station identity is self-verifying**: each series' rulebook names its
  station (`(CLINYC)`); the registry entry is cross-checked every cycle and
  mismatches are skipped + queued. Unmapped/international KXHIGHT* series are
  never priced.
- The market-implied probability we score against is the bid/ask mid at
  placement; on degenerate books it falls back to last trade.

## Data

`data/` (gitignored): `ledger.db` (sqlite), `bias.json`, `cache/` (CLI
archive pulls), `regime.json` (external drop). Delete `data/` to reset the
paper record — the gate clock restarts.

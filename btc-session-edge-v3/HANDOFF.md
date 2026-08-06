# BTC Session Edge v3 — session handoff

**Date:** 2026-08-06 · **Branch:** `claude/btc-edge-v3-defects-h9m9m1` · **PR:** #35 (open, draft)

Read this before touching anything. It exists because this session found four
independent defects that all biased the same direction, and the next session
needs to inherit the suspicion, not just the code.

---

## Where the code lives

| Path | What it is |
|---|---|
| `btc-session-edge-v3/index.html` | The shipping bundle. Open directly, no build step. **Canonical.** |
| `btc-session-edge-v3/src/app.html` | The reviewable source — the real document. **Edit here.** |
| `web/public/btc-session-edge-v3.html` | The served copy. Next.js publishes it at `/btc-session-edge-v3.html`. |
| `btc-session-edge-v3/tools/bundle.mjs` | `extract` / `inject` / `deploy` / `verify` |
| `btc-session-edge-v3/tools/behaviour.mjs` | 137 Node assertions |
| `btc-session-edge-v3/tools/selftest.mjs` | Browser: 14 in-artifact + 3 layout + 10 grouped-log |

**Edit loop:**
```
$EDITOR src/app.html
node tools/bundle.mjs inject     # src -> index.html
node tools/bundle.mjs deploy     # index.html -> web/public
node tools/behaviour.mjs         # 137
node tools/selftest.mjs          # needs playwright; see note below
node tools/bundle.mjs verify     # gates round-trip + both copies in sync
```

`verify` fails if `index.html` is stale relative to `src/app.html`, or if the
`web/public` copy has drifted. Run it before every commit.

**selftest.mjs quirk:** playwright is not a repo dependency. Symlink it from the
scratchpad and run *from the `btc-session-edge-v3` directory*:
`ln -sfn <scratchpad>/node_modules node_modules && node tools/selftest.mjs`.
`behaviour.mjs` has no deps and must be run **from the repo root**.

---

## The four defects found this session — the pattern is the lesson

All four biased toward **false confidence**. Three were caught by a human
looking at a rendered number and saying "that seems off," not by the tests.

1. **σ_cur inflated 25%** — the 0.798 mean-absolute correction applied twice.
   (This one made the dial *under*-confident.)
2. **Cached feed logged as fresh reads.** The 1-min candle endpoint declares
   `cache-control: max-age=300`. Identical prices became independent
   observations → σ collapsed → z inflated → a $31 move showed "UP 100%".
3. **σ chain sampled per poll, not per minute.** Polled ~3×/min, every poll
   appended; the estimator skips same-minute pairs, so it measured the seconds
   straddling a minute boundary and divided by √1. **Understated σ 2.1×.**
   Independent of #2 and survived its fix.
4. **`B = 1.77` calibrated for a pipeline that doesn't run.** Fitted with M
   pinned at 1; the dial multiplies by M, whose median on the real
   `HOUR_SIGMA` basis is 0.677. Measured: 80–90% band hit 81.7%, 90–95% hit
   89.1%. Now **1.49**.

**If you are about to add a factor or change a constant, assume there is a
fifth.** The places to look: anywhere σ, `REMVAR`, `k`, or the CT hour index can
be silently wrong; boundary behaviour at k=1 and k=14; what happens when the tab
sleeps or a session is missed.

---

## What shipped, and what deliberately did not

**Shipped:** B → 1.49. Storage compaction + pruning + visible write failure +
CSV export. Session-grouped log with MY LOG / SHADOW split. Shadow mode with
ticker feed, staleness guard, mid-session-start guard. Probability display
clamped to 1–99%.

**Deliberately NOT shipped, with reasons:**

- **`mult()`'s K constant (0.798).** K and B are jointly identified through the
  z-scale. With B refit, test Brier is flat across K from 0.45 to 0.798
  (0.15341–0.15357). Changing K without refitting B re-miscalibrates the other
  way. An external review argues K should change anyway because the [0.5, 2.5]
  clamp censors 27.8% of M windows at the floor — that argument is not about
  Brier and was not independently verified here.
- **Per-k blend schedule {0.2, 0.7, 0.8}.** Review measured −0.00082
  (significant); independent check here measured **+0.00013, CI spanning zero**.
  Same direction, 6× apart on magnitude. Unresolved.
- **Vol-regime slope interaction (γ = −0.13), weekend σ multiplier, EWMA-mean M,
  quantile-matched baseline, empirical REMVAR arrays, drift → single band.**
  All single-source measurements on one 28-day window. Not verified here.

---

## Methodological warning — read before trusting any number in this repo

The round-1 momentum bootstrap used a hand-rolled LCG whose multiply overflows
2^53: **16,403 distinct values in 200,000 draws.** Any confidence interval
produced before 2026-08-06 is suspect. Re-run with `mulberry32`.

Related, and more important: an effect of |ΔBrier| < 0.0002 between two
near-duplicate models will produce a hair-thin CI under a paired bootstrap
**regardless of whether the effect is real.** Treat that band as "no effect"
however many stars it has. This is why the momentum claim was withdrawn even
though its arithmetic held up.

Standard protocol for any new factor: 70/30 split **by session date**, refit B
per variant on train only, evaluate on test only, paired bootstrap **clustered
by session** (14 minutes inside one session are correlated — clustering by row
shrinks error bars ~4× and manufactures significance).

---

## Verified external facts (2026-08-06)

- **Kalshi 15-min series is `KXBTC15M`.** `floor_strike` is the exact strike —
  confirmed 64416.42 against the operator's observed 64,416.
- **Kalshi's API is closed to browsers.** `api.elections.kalshi.com` returns
  **403 whenever an `Origin` header is present**, preflight included; 200
  without. Reaching it requires a server-side proxy or collector.
- Future markets return `status: "initialized"`, `floor_strike: null` — the
  strike only materialises at open, so there is no pre-arming.
- **Coinbase endpoints:** `ticker` `max-age=1` (used), `candles?granularity=60`
  `max-age=300` (unusable live, fine for retrospective backfill of past
  minutes), `v2/prices/spot` `no-store`. All send
  `access-control-allow-origin: *`.
- Settlement is CF Benchmarks BRTI, averaged over 60 prices in the final minute
  — which is what `REMVAR` vs `REMVAR_CLOSE` models.

---

## Highest-value next steps

1. **Server-side Kalshi collector → Supabase.** Unblocks the real strike, the
   official settlement, and quote history — which in turn makes intra-session
   strategy, basis measurement, and any sizing backtest testable at all. The
   artifact can soft-fetch your own CORS-open Vercel route and degrade to
   today's behaviour offline, preserving the `file://` requirement.
2. **Resolve the blend-weight disagreement** before shipping it.
3. **Do not add position sizing until you trust the calibration.** Worked
   example: displayed 90% at an 85¢ ask, naive Kelly stakes 29% of bankroll;
   with the calibration correction applied the answer is *no trade*. The entire
   apparent edge was the calibration gap.

---

## Operator notes

- Shadow mode's strike is **synthetic** (session-open Coinbase price), roughly
  $5–20 off Kalshi's real strike — timing plus exchange basis. Fine for
  calibrating the model; **not** for trading. Type Kalshi's real strike for a
  live trade.
- Any shadow log recorded before 2026-08-06 20:20 UTC is contaminated by
  defects 2 and 3. Clear it.
- `clear log` clears the traded log. The shadow log is separate (`edge.shadow.v3`).

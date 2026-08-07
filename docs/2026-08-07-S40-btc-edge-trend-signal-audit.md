# S40 — Does the model look at up/down trend? Audit against the baked sessions

**Date:** 2026-08-07 · **Branch:** `claude/btc-edge-remaining-time-68fe9v` (off `main` @ `8db1b40`) · No model change shipped.

Terry's question: *"IS our data even doing the equivalent of looking at the up/down trends to estimate?"*

Answer in one line: **almost no — there is exactly one directional term, worth ≤4.8pp, dead by minute 8, and switched off in every shadow read and for the first 75 minutes of any live run.**

Reproduce everything here with `node btc-session-edge-v3/analysis/trend-signal.mjs`.

---

## HEADLINE

| # | Finding | Class | State |
|---|---|---|---|
| A | The model is direction-blind except for `driftNudge`, which is inert in the two situations it is most often evaluated | repo-state, verified | **new — defect 11 candidate** |
| B | "4 up sessions → next is down" is **not** in the data | world-fact, measured | Terry's premise, corrected |
| C | The **size** of the 5-session net move *is* a real ~5–6pp fade — and `driftNudge` already encodes it | world-fact, measured | confirms shipped design |
| D | `M` estimates recent volatility from `\|finalDelta\|`, the single worst statistic available; a per-minute-vol estimator scores 0.527 → 0.621 | methodology | **held back — needs replication** |
| E | Defect 9's error table reproduces exactly; option B (cube shrink) closes ~half the minute-14 gap, not all of it | repo-state, verified | feeds the open minute-14 decision |

---

## A. Where direction enters the model — and where it doesn't

`src/app.html:1231`, the whole of `model()`:

```
sigmaRem = sigmaUnit × √REMVAR[k]
z        = (price − strike) / sigmaRem
logit    = B × z + driftNudge(net, k)      ← only this term carries a sign
p        = sigmoid(logit)
```

Every volatility input is built from `Math.abs()`, squares, or RMS — `mult()` (`:828`) uses `Math.abs(e.finalDelta)`, `sigmaFromPts()` (`:851`) uses `Math.abs(...)` then squares. **The sign is discarded before the number reaches the model.** That is correct for a volatility estimate and it means those terms cannot express trend even in principle.

`driftNudge` (`:664`) is the sole exception, and it is Terry's idea already implemented: `net = strike − px75`, `px75` = the first logged price five sessions (75 min) back, nudging *against* the move.

**Verified this session, in the harness:**

| Property | Value |
|---|---|
| Max magnitude | 0.1925 logit @ k=1 on $120 net = **4.8pp** at p=0.5 |
| Zero from | **k=8** onward — hard `Math.max(0, (8-k)/8)` |
| Source of `px75` | `autoPx75()` (`:813`) reads `this.state.sess[ts − 4500]` — the **traded** store |
| Cold start | `sess = {}` → `autoPx75` returns `""` → `net = null` → **nudge = 0** |
| Shadow mode | `shadowRead()` (`:1084`) passes **`net: null` hard-coded** |

Consequence, confirmed numerically rather than by inspection: in a shadow read, `p` and the `noDrift` ablation come back **bit-identical** (0.372908 both). So:

1. The **"D" ablation column is dead in every shadow row** — it can never differ from the main column.
2. **Every calibration number we hold — `B=1.49`, the Brier, the hit rate — was measured with the directional term switched off.**

`armFromCandles()` (added in #39) already proves the Coinbase candle endpoint can retrieve past session opens, so `px75` is backfillable. It currently isn't.

---

## B & C. Terry's intuition, split and tested on 2,688 sessions

Bitstamp BTCUSD 1-min, Jul 8 – Aug 4 2026, 28 days. Wilson 95%.

**B. Direction of a run does not predict the next session.**

| Lead-in | P(next UP) | 95% |
|---|---|---|
| after 4 straight UP | 52.6% | [44.7, 60.4] |
| after 4 straight DOWN | 54.5% | [46.7, 62.2] |

A real reversal signal must put the two run-directions on **opposite** sides of 50%. These land on the **same** side, which makes it noise regardless of distance from 50%. (One bucket of ten cleared 50% — 5-straight-down → 62.9%, n=70 — which is what ten tests produce by chance.)

**C. The dollar size of the 5-session net move does predict a fade.**

| 5-session net | P(next UP) | 95% | fade? |
|---|---|---|---|
| $80–200 **up** | **44.2%** | [39.7, 48.8] | ✓ excludes 50% |
| $80–200 **down** | **55.1%** | [50.4, 59.8] | ✓ excludes 50% |
| $20–80 / $200+ | 48.1 / 46.5 · 51.5 / 54.2 | span 50% | right sign, not significant |

~5–6pp, strongest in the **middle** bucket — which is exactly the non-monotonic shape `driftNudge` already ships (0.07 / **0.22** / 0.16). Terry has the mechanism right and the trigger wrong: it is the size of the move, not the count of sessions.

**Within-session continuation is flat at 50%** — 49.7 / 50.2 / 49.3 / 49.7 / 49.0% at minutes 3/5/8/11/13. The random-walk assumption inside the session is sound; the model is right not to trend-follow there.

---

## D. Volatility is where the signal is — and `M` uses the wrong statistic

Correlation with the session's realised volatility, at minute 6:

| predictor | corr |
|---|---|
| `HOUR_SIGMA` — hour-of-day, 28d | 0.377 |
| trailing 24 sessions (6h) | 0.398 |
| trailing 12 sessions (3h) | 0.503 |
| trailing 4 sessions (1h) | **0.576** |
| `sigmaCur` — this session so far | 0.538 |

Volatility clusters hard — roughly 10× the directional effect. The three-layer structure Terry described already exists and is the right shape.

But `mult()` builds `M` from **`|finalDelta|` — one number per session, the net 15-minute move.** A session that ran +$200 and returned to +$5 is recorded as $5 of volatility, discarding the other 14 observations.

| version | corr | RMSE(log) @ k=2 |
|---|---|---|
| shipped `HOUR_SIGMA × M12`, from `\|finalDelta\|` | 0.527 | 0.5443 |
| same window, from realised per-minute σ | **0.621** | **0.4964** |
| shipped estimator, 4-session window | 0.464 | — |

**The problem is the estimator, not the lookback length** — shortening the window on `|finalDelta|` makes it *worse*. The improvement concentrates at early minutes (k=2–6) and is neutral-to-worse by k≥10.

**Deliberately not shipped.** `sigmaUnit` feeds `z`, and `B=1.49` was fitted to `z` — moving it re-miscalibrates, per HANDOFF.md rule 2. Also, RMSE on a volatility forecast is **not** Brier on real outcomes; the gain here does not establish a gain on the thing that matters. Needs independent replication and a Brier measurement first.

**Data gap:** `SESS` is 16 columns — one σ and 15 cumulative deltas. **There is no volume anywhere in the dataset.** Any volume-conditioned work needs new data pulled first.

---

## E. Defect 9 — table confirmed, and what minute 14 costs

The S39 table reproduces to the decimal (13 → 9.8pp, 14 → 15.8pp; σ_rem $9.93 vs S39's $9.94, rounding).

Terry's live catch — 36s left, $2.41 below target, Kalshi 21%:

| approach | σ_rem | p(up) |
|---|---|---|
| today, whole-minute lookup | $9.93 | **41.1%** |
| A. straight-line interpolation | $7.69 | 38.5% |
| B. settlement-average **cube** shrink | $4.61 | 31.5% |
| B+. cube + elapsed-window term | $4.78 | 32.1% |
| Kalshi (implied) | ($2.71) | **21.0%** |

Averaging over a shorter *remaining* window shrinks variance by the **cube** of the fraction left — at 36s left, 0.6³ = 0.216, not 0.60. Straight-line interpolation is wrong at minute 14 specifically for this reason.

Two things that matter for the decision:

- **A closes ~1/10 of the gap; B closes ~1/2.** Neither reaches Kalshi, so part of 41→21 was never a clock problem — most likely the σ base being too high for a quiet moment.
- The $2.71 is **derived** by inverting our own logit at Kalshi's 21%, so it carries `B=1.49`. An estimate, not a measurement.

**Hard limit:** the baked data is 1-**minute** bars. The true within-minute-14 behaviour **cannot be measured from this file** — that needs second-resolution data.

**Open, awaiting Terry: which of A / B / B+ to implement for minute 14.** Minutes 1–13 are straight-line and uncontested.

---

## Judgment calls

- **Shipped no model change.** Findings A and D both touch `sigmaUnit`/`logit`; HANDOFF.md rule 2 forbids moving jointly-identified constants on new evidence. Reported, not applied.
- **Branch based on `main`, not on PR #39.** #39 is open and edits `src/app.html`; this commit adds only new files, so it carries zero conflict risk and its diff does not replay #39's work. The defect 9/10 code will rebase onto whichever base applies then.
- **No Linear tickets.** Unchanged from S37–S39 — BTC Session Edge is not on the THS board.

## Prod database state

**Unchanged.** No migrations, no writes, no schema work.

---

*Verified this session: `btc-session-edge-v3/src/app.html` (`model`, `read`, `shadowRead`, `mult`, `sigmaFromPts`, `autoPx75`, `driftNudge`, `rail`), `tools/behaviour.mjs` (190/190 PASS), the bundled `sessData` dataset, `.github/workflows/ci.yml`.*

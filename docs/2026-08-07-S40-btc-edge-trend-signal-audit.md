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
| E | Defect 9's error table reproduces exactly; option B (cube shrink) closes ~half the minute-14 gap, not all of it | repo-state, verified | **defects 9 + 10 fixed, B+ per Terry** |
| F | The minute-14 factor is **not monotonic** — it re-widens over the final 20 seconds | methodology | **shipped as chosen; surfaced to Terry** |

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

### Terry chose B+ — shipped

`remVarAt(D, k, sec, settleAvg)` replaces the whole-minute `REMVAR[k-1]` lookup. Minutes 0–13 drain linearly; minute 14 uses

```
remVar(14, f) = REMVAR[13] × ( (1−f)³ + f³/4 )
```

At `f=0` the bracket is 1, so it is **exactly continuous with the baked table** and every prior fixture still holds — asserted for all k on both bases.

**Discovered while implementing, and Terry did not have this when he chose: the minute-14 factor is not monotonic.** It bottoms at `f=2/3` (40 seconds in, factor 1/9) and **rises back to 1/4** at the close:

| into minute 14 | 0s | 10s | 20s | 30s | **40s** | 50s | 60s |
|---|---|---|---|---|---|---|---|
| factor | 1.000 | 0.580 | 0.306 | 0.156 | **0.111** | 0.149 | 0.250 |

On screen the probability will converge for the first 40 seconds of the final minute and then **visibly widen back toward 50%** for the last 20.

**This is real, not a bug.** Settlement is the average of 60 prices the tool never observes. As the minute runs out, the *current* price stops being a good proxy for the minute's *average*, so uncertainty about that average stops shrinking. Any model that prices an unobserved average off a single current price has this shape — option B has it too (minimum at f=1/2), and even the "correct" formula conditioned only on the current price never converges at all.

An initial assertion demanding monotonicity across all 15 minutes **failed at k=14 and was wrong** — the assumption was mine, not the model's. Replaced with assertions pinning the exact shape (bracket = 1 at f=0, 1/9 at f=2/3, 1/4 at f=1) so it cannot drift silently.

**The clean fix is to stop guessing at the elapsed average and accumulate it** — the poll already runs every 20s, so the prices are observable. With the elapsed window known the factor becomes `(1−f)³`, which *is* monotonic to zero. Out of scope here; flagged for Terry.

**One asymmetry deliberately left in place.** `read()` now admits minute 0, but the shadow loop keeps its `k >= 1` guard. The traded strike is Kalshi's target, so a minute-0 delta is a real number worth pricing; shadow's synthetic strike **is** the session open, so its minute-0 delta is zero by construction and would log a guaranteed `p=0.5` row every session — no information, but it inflates `n` and drags the calibration curve.

---

---

## G. There is no edge in the probability at any confidence level

Added after Terry ran 15 live shadow sessions and asked what to do with the 60s — whether to split them at 65. The live log was 209 reads across 15 sessions, which cannot resolve a band split. The baked dataset can: replaying the exact `shadowRead()` pipeline over all 2,688 sessions gives **37,408 reads**.

Reproduce with `node btc-session-edge-v3/analysis/calibration-replay.mjs`.

| band | bets | rate | breakeven after fees | edge |
|---|---|---|---|---|
| 50–54% | 3,900 | 54.1% | 54% | +0.2pp |
| 55–59% | 3,973 | 57.8% | 59% | −1.2pp |
| **60–64%** | 3,922 | **63.9%** | 64% | **+0.0pp** |
| **65–69%** | 3,385 | **69.0%** | 69% | **+0.1pp** |
| 70–74% | 3,000 | 73.0% | 74% | −1.0pp |
| 75–79% | 2,820 | 78.3% | 79% | −0.6pp |
| 80–84% | 2,645 | 82.8% | 84% | −1.2pp |
| 85–89% | 2,668 | 87.0% | 88% | −0.9pp |
| 90–94% | 2,837 | 91.7% | 93% | −1.4pp |
| 95–100% | 8,258 | 97.8% | 100% | −1.8pp |

**The model is calibrated to within ~1pp in every band, and after Kalshi's taker fee every band is a slow loss.** Overall: mean stated 76.3% vs actual 77.1%, a gap of +0.7pp.

Consequences, all of them negative results worth recording so they are not re-derived:

- **No split of the 60s.** 60–64 gives +0.0pp, 65–69 gives +0.1pp. There is no structure to divide.
- **No profitable band, and no profitable filter.** Not 55–85%, not 60–89%, not "confirmed dips" (a 50s read on the same side as an earlier 60%+ read in the same session).
- **The apparent under-confidence in the live log was luck.** 15 sessions showed 13–17pp of under-confidence in the 60–90 bands and a hypothetical +21% on turnover. Over 37,408 reads that effect is +0.7pp overall. Fifteen sessions is ~15 effective observations — nowhere near enough, since reads inside a session almost all resolve together.

**This is the quantitative form of Terry's own framing from S39** — *"the gap is the product."* A calibrated model betting at its own price loses to fees by construction; that is what calibration means. Only a divergence from Kalshi's actual quoted price can pay, which is exactly what the GAP tab measures and why `mkt ¢` has to be typed on real reads.

**Caveat, load-bearing: the replay is IN-SAMPLE.** `B = 1.49` was fitted on these same 2,688 sessions, so near-perfect calibration is partly what fitting produces, and this does **not** establish out-of-sample calibration. It does remove any basis for claiming an edge — an edge would have to appear here first. The only out-of-sample evidence is the 209 live reads, which are far too few.

---

## Verification

| check | result |
|---|---|
| `node btc-session-edge-v3/tools/behaviour.mjs` | **192/192 PASS** (18 new S40 assertions) |
| `node tools/selftest.mjs` (real browser) | **20/20** in-artifact, 3 layout, 10 grouped-log |
| `node tools/clock.mjs` (real browser, controlled clock) | **9/9 PASS** |
| `node tools/bundle.mjs verify` | round-trip, src, deployed copy all in sync |

`tools/clock.mjs` is new. Defects 9 and 10 are page-level — the fix is only real if the number on screen moves as the seconds drain, and the Node harness structurally cannot see that (`props={}`, synchronous `setState`). It drives the real page with `Date.now` replaced before any app code runs. Measured in the browser at a $10 gap:

- **minute 13: 69% → 81%** across one minute (previously frozen), σ_rem $18.5 → $10.2
- **minute 2: headline stable at 56%**, σ_rem still ticking $67.1 → $64.4 — the cliff-at-the-end characterisation, confirmed on screen
- **minute 0: 55%**, no longer "session just opened", and correctly the least confident read of the session

---

## The gap log — shipped

> *"I would want to know when it may be a true 50/50 bet based on historicals but Kalshi has it priced at 40 cents to buy the upside. But I don't see how this tells me that."*

A probability that agrees with Kalshi is a redundant display — you can read Kalshi's own number off their screen. The product is the **disagreement**, and whether it pays.

**New GAP tab.** `ceilings()` already computes the most a contract is worth paying after fees; the gap is that ceiling minus what the book is asking, on whichever side is the better buy. `gapOf()` picks the side, `gapPnl()` books the result, `gapRows()` keeps every resolved read where the tool claimed ≥1¢, `gapAgg()` scores them.

**Nothing new had to be recorded.** Every logged read already carried `mktCents`, `yesT` and `noT`, and `resolved` lands at the session close — so the track record is built **retroactively out of reads taken before the view existed**. Terry's existing log will populate it on first open.

The headline is **claimed edge vs realised**:

| SIGNALS | HIT RATE | CLAIMED EDGE | REALISED |
|---|---|---|---|
| 3 | 67% | 18.3¢ | +31.3¢ |

Those two converging is the only evidence the edge is real. Claimed staying high while realised sits near zero means the gap is noise, however many signals it fires. **Losses are rows** — a track record that keeps only its winners is the exact failure this log exists to prevent.

**On the TRADE tab** the edge is now a number in its own bar (`+16¢ · BUY YES ≤ 56¢`) instead of a verdict string in a side panel. Without a market price typed it says so plainly rather than showing nothing.

**Two limits, stated in the UI rather than hidden:**
- **Shadow reads can never appear here.** Kalshi's API is closed to browsers, so shadow has no market price to disagree with. The footer says this.
- **Market price is still manual.** Same cause. Nothing in the browser can fetch it.

## Judgment calls

- **Shipped no change to findings A or D.** Both touch `sigmaUnit`/`logit`; HANDOFF.md rule 2 forbids moving jointly-identified constants on new evidence. Reported, not applied. Defects 9 and 10 are a different case — the whole-minute lookup is wrong *by construction*, not by re-estimation, and `sec=0` continuity means `B` is not re-based.
- **Reverted `trade-tab-1440x900.png`.** Running `selftest.mjs` regenerates it as a side effect; nothing visual changed, so shipping the diff would be noise.
- **Branch based on `main`, not on PR #39.** #39 is open and edits `src/app.html`; this commit adds only new files, so it carries zero conflict risk and its diff does not replay #39's work. The defect 9/10 code will rebase onto whichever base applies then.
- **No Linear tickets.** Unchanged from S37–S39 — BTC Session Edge is not on the THS board.

## Prod database state

**Unchanged.** No migrations, no writes, no schema work.

---

*Verified this session: `btc-session-edge-v3/src/app.html` (`model`, `read`, `shadowRead`, `mult`, `sigmaFromPts`, `autoPx75`, `driftNudge`, `rail`), `tools/behaviour.mjs` (190/190 PASS), the bundled `sessData` dataset, `.github/workflows/ci.yml`.*

# BTC Session Edge v3 — session handoff

**Date:** 2026-08-07 · **Branch:** `claude/btc-edge-v3-calibration-7wceyz`

Read this before touching anything. It exists because two sessions running have
found defects that all biased toward false confidence, and the next session needs
to inherit the suspicion, not just the code.

---

## THE FIFTH DEFECT WAS REAL — and the test for it could not have found it

The previous session's closing recommendation was: *"let shadow mode run several
days, then check calibration. If displayed 80% reads hit ~80%, the `B` fix
worked. If not, there is a fifth defect."*

**That test returns a false all-clear.** There were three more defects, and two
of them cancel each other inside shadow mode specifically:

| # | Defect | Effect |
|---|---|---|
| 5 | **`B` shipped at 1.77, not 1.49.** `data-props` declared `bConstant` default `1.77`; the DC runtime passes declared defaults in as props, so `this.props.bConstant` was `1.77` and `activeB()`'s `?? 1.49` fallback never fired. #35 changed the fallback and the footer string, never the declared default. | The traded dial ran the **pre-#35 slope**. Defect 4 was never actually fixed in the browser. |
| 6 | **Shadow mode computed `M` from the traded log.** `mult()` read `this.state.sess`, which shadow never writes. An unattended shadow run had **M pinned at 1** forever — and a shadow read's probability moved when an unrelated *traded* session resolved. | Shadow ran a different pipeline from the dial it exists to validate. |
| 7 | **The scorecard and CALIBRATION panel always read the traded log**, in both MY LOG and SHADOW modes. Only the row table switched. | The one instrument that answers "do displayed 80% reads hit 80%" never displayed shadow data. Verified: 40 shadow reads at 85% confidence, all wrong — panel showed `n0` in every band. |

**Why the proposed test was structurally blind.** `B = 1.77` was fitted on a
basis with `M` pinned at 1. Defect 6 pins `M` at 1 in shadow mode. So shadow
mode was running *the exact pipeline 1.77 was calibrated for* — while the traded
dial ran `M` live at `B = 1.77`, which is precisely defect 4. Measured on the
2,688-session baked set, replaying the real `shadowRead`/`model`/`mult` methods:

| Configuration | displayed 80% → actual | 80–90 band |
|---|---|---|
| **What shadow ran** (B 1.77, M pinned 1) | 82.9% | 85.0 → 85.2 (+0.2) |
| **What the traded dial ran** (B 1.77, M live) | **76.2%** | 85.1 → **81.2** (−3.9) |
| **After this fix** (B 1.49, M live both sides) | **80.3%** | 85.0 → 84.7 (−0.3) |

The middle row independently reproduces the previous session's own defect-4
measurement (they measured the 80–90 band at 81.7%; this replay gets 81.2%),
which is what establishes the replay is faithful.

**The lesson, stated plainly: a paper-trading mode that does not run the same
pipeline as the live dial validates nothing, and will report success loudest
exactly when the live dial is broken.** Two bugs cancelling is not calibration.

**Standing implication: assume an eighth.** The suite passed at 145 assertions
across all three of these. Defect 5 in particular passed *because* `behaviour.mjs`
constructs the component with `props = {}` — the one condition under which the
dead fallback fires. **Any constant that reaches production through a
framework-supplied default is invisible to a test harness that supplies no
props.** `feeK`, `makerMult` and `macroSigmaMult` reach the dial by the same
route and are now covered by the same assertion style; anything added later must
be too.

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
fifth.** There was — see the top of this file. The places still to look: anywhere
σ, `REMVAR`, `k`, or the CT hour index can be silently wrong; boundary behaviour
at k=1 and k=14; what happens when the tab sleeps or a session is missed.

**One visible consequence of fixing defect 7.** The ablation aggregate on the
SHADOW tab now reads `needs 30 more rows` instead of showing numbers. That is
correct: compaction drops the `ab` block from resolved shadow rows, so the
shadow log genuinely has no ablation data — it was previously showing the
*traded* log's ablations under a SHADOW header. Making that panel useful in
shadow means keeping `ab` through compaction (review round 3 §4.2 calls it
"your call"; it costs the bytes compaction exists to save). Left as-is: a panel
that says it has no data beats one that quietly shows a different log's.

Two the replay surfaced but did **not** fix, both already on the ranked list:

- **`sigmaFromPts` is biased low early in a session.** It returns
  `sqrt(mean(u²))`, so at k=2 there is exactly one squared difference and the
  estimator collapses to `|u|`, whose expectation is 0.798σ — σ_cur understated
  ~20% at k=2, ~11% at k=3, decaying after. σ_unit is a 0.6/0.4 blend so the
  effect on the dial is ~8% at k=2. A pooled `B` cannot absorb a k-dependent
  bias. Interacts with the per-k work in review round 3 §3; do not fix in
  isolation.
- **`pruneShadow` is O(rows × sessions) inside every 20-second persist** once
  rows exceed the cap (round 3 §4.4). Not a correctness bug. `shadowSessions()`
  adds a full `srows` scan per read and per render — trivial at 25k rows, but it
  is on the same hot path if the cap ever rises.

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
- **Any shadow log recorded before this session is contaminated by defects 5 and
  6** — it was scored by a dial running `M = 1` at `B = 1.77`. Shadow rows are
  now tagged `v: 3`; the status line names how many pre-v3 rows are present and
  tells you to clear. **Clear the shadow log and restart it** — the numbers in it
  describe an engine that no longer exists.
- `clear log` clears the traded log. The shadow log is separate (`edge.shadow.v3`).
  PR #37 makes the button act on whichever log is on screen.
- Shadow `M` is inert until **4 resolved shadow sessions** (one hour of running).
  The M tile says `inert — needs 4 sessions (n…)` while that is true, so a pinned
  M is now visible rather than silent.

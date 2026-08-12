# S41 — BTC Session Edge: four closed routes, the band nobody checked, and a live phantom edge diagnosed

**Date:** 2026-08-08
**Branch:** `claude/btc-edge-remaining-time-gap-1y1klg`
**PRs:** #40 and #41 **merged to main** by Terry at 07:04Z · **#42 open, draft, CI 4/4 green**
**Artifact:** `btc-session-edge-v3/` — not on the Linear board
**AI Thesis proper:** unchanged. Nothing moved since S36.

---

## HEADLINE — read this before proposing any new filter

**Four routes are now closed, and the fifth is the only one left.** Each was closed by
measurement, not by argument, and each has its retraction attached where I got
something wrong first.

| # | Route | Verdict | Where |
|---|---|---|---|
| 1 | The probability alone | Calibrated to ~1pp; every band −1.8pp to +0.2pp of breakeven after fees | S40, 37,408 reads |
| 2 | Prior-session trend alone | No interval predicts. The 9.4pp / 75-minute peak was in-sample noise | S41, `interval-search.mjs` |
| 3 | Maker execution | Fee is 1.8¢; **adverse selection is ~13¢**. Resting is ~17× worse than taking | S41, `maker-fill-backtest.mjs` |
| 4 | Conditional / combined filters | Crossing streak with the band makes it **worse**; a 5,292-rule back-solve failed its null at **p = 0.323** | S41, `conditional-edge-search.mjs` |
| 5 | **The gap vs Kalshi's actual quote** | **STILL UNTESTED — the only route left** | needs the price feed |

**The one actionable finding of the session:** the 60–89% band was never derived.
Terry named it and every study since inherited it. Sweeping 15 bands shows it is
not optimal, and shows something stronger:

**Above 90% confidence, the model is a confirmed loser with CIs that exclude zero.**
That is the most statistically solid result this project has produced, and it is
negative. See §3.

---

## Retractions — claims I made this session that later measurement killed

Recorded first because a handoff that buries its own corrections is worse than
no handoff. Do not re-assert any of these.

1. **"The taker fee was the entire binding constraint" / "the strategy isn't
   unprofitable, taking is."** Stated before modelling the fill. **Wrong.**
   Modelled, it inverts: on a binary the price *is* the market's probability, so
   a resting bid fills exactly when the estimate moves against you. Filling is
   the news. Removing the fee while accepting maker fills makes the strategy
   roughly **seven times worse**, not profitable.
2. **The 75-minute lookback peak.** `lookback-sweep.mjs` found L=5 (75 min) best
   at 9.4pp separation. `interval-search.mjs` fixed two flaws — a fixed `|net| ≥ $80`
   bucket that handicapped long lookbacks by construction, and picking-and-scoring
   the winner on the same data — and it **does not reproduce**. Spearman −0.187
   held out.
3. **My own band rule, given to Terry mid-session and wrong within the hour.** I
   told him: compare the book's ask to the bottom of the Wilson band; below the
   band = real, inside = noise. It handles uncertainty in the *hit rate* and is
   blind to error in the *inputs*. On his live 19¢ read it said **take the trade**.
   The correct check comes first and is in §6.
4. **"Minutes 9–11 are the back-solve trap."** Too quick a dismissal. Tested
   properly it is positive in both halves (train +1.56%, test +0.70%) and beats
   the all-minute baseline out of sample. It still does not clear the bar, but
   the reason is subtler than I first said — see §4.

---

## What shipped

### Merged to main (#40 by Terry, #41 by Terry, both 07:04Z)

`main` = **`8c543bf`**. Verified **by content, not ancestry** — both were squash
merges, so `git merge-base --is-ancestor` returns false by design and looks like
a stranded branch. `git diff origin/main <branch>` was **empty**; trees identical.
Production deploy `dpl_CQqpPb5QrEEqNWWHC7hsrrAjGFL8`, commit `8c543bf`, 07:04:48Z.

**#41 carried defect 13 and the implausible-edge guard**, both of which are now
live and both of which mattered within the hour:

- **Defect 13 — the market price had no side.** The field was a bare `mkt ¢ (YES)`
  and Terry typed whichever side Kalshi was quoting. `gapOf()` derives the
  opposite side as `100 − v`, so a DOWN price of 77 became a YES price of 77 and
  a NO ask of 23. The tool printed **BUY NO @23¢ +32¢**; the truth was **BUY YES
  @23¢ +17¢** — same money, opposite outcome. Reading the tool inverted does not
  recover it: near even money both readings name the same side, and the stored
  `mktCents` stays wrong regardless, which is what the GAP track record is built
  from. Fixed by `mktYes()` canonicalising to YES cents from an explicit YES/NO
  toggle.
- **The ~15¢ implausible-edge guard shipped.** `IMPLAUSIBLE = 15`. **This closes
  S40 pending item 3** — it is no longer an open ask. It fired correctly on
  Terry's live 19¢ read (§6).

### Open in #42 — five commits, three new scripts, no model change

| commit | what |
|---|---|
| `c5b76e8` | `conditional-edge-search.mjs` — trend × band cross, 5,292-rule back-solve, 200-run null |
| `86c7271` | `m-estimator-brier.mjs` — the gated M measurement |
| `620e515` | `flat-stake-strategy.mjs` — `--stake=N`, plus split by position in session |
| `358639b` | `band-window-sweep.mjs` — 15-band sweep, minute-window sweep |
| `534e963` | k5-7 / k7-9 / k9-11 side by side, plus non-overlapping partition |

All read-only. Nothing imports from the artifact, re-fits anything into it, or
writes. `m-estimator-brier.mjs` refits `B` for measurement only.

---

## 1. Route 4 closed — conditional and combined filters

Terry: *"why are we still not looking into the combined outcomes of things like
after 3 or 4 down or up sessions and then only betting if between 60-89? Also why
cant we back solve for trends that result in profitability?"*

Both fair. The cross had **genuinely never been run** — prior sessions tested
streak alone (noise) and band alone (calibrated) and never crossed them.

**Conditioning on a streak makes the band worse:**

| filter on 60–89% | bets | rate | breakeven | edge |
|---|---|---|---|---|
| any streak | 18,440 | 74.6% | 75.1% | −0.5pp |
| streak ≥ 2 | 8,902 | 74.6% | 75.3% | −0.6pp |
| streak ≥ 3 | 4,320 | 73.4% | 75.2% | **−1.8pp** |
| streak ≥ 4 | 2,176 | 72.8% | 75.1% | **−2.3pp** |

Only non-negative cells are **against** the trend (+0.4pp at streak ≥ 2, +0.0pp
at `|net5| ≥ $80`) — the fade S40 measured and `driftNudge` already encodes.
Betting **with** a large recent move is the worst cell on the board at **−4.1pp**.

**The back-solve, guarded three ways.** 5,292 rules over band × minute-range ×
streak × 5-session-net-move × direction. 70/30 split by session date, searched on
train only, best rule scored once on held-out data:

| | bets | rate | breakeven | edge | net/$1 |
|---|---|---|---|---|---|
| train | 517 | 79.3% | 76.2% | +3.1pp | +$0.0418 |
| **TEST** | 272 | 80.9% | 77.6% | **+3.3pp** | **+$0.0490** |

**It failed its null.** Re-running the identical search **200× with session trend
features shuffled across sessions** — destroying the feature→outcome link while
preserving calibration, band structure and within-session clustering exactly —
the best-on-train rule scores a **median +$0.1123/$1 on pure noise**, *higher than
the real search managed*. Carried to test, **64 of 200 noise runs match or beat**
the real result. **Empirical p = 0.323.** Test CI **[−6.92%, 15.57%]**.

The real data offered the search *less* to work with than noise does. That is the
cleanest available statement of why back-solving fails here.

**Honest limitation on the null:** shuffling features also destroys their temporal
autocorrelation, so the null's rule pool is slightly more diverse than the real
one. That affects the null's calibration at the margin, not the conclusion — the
real result sits mid-mass, not at the edge.

---

## 2. The M estimator — gate 1 of 2 FAILED, do not ship

S40 held this pending *"a Brier measurement and independent replication
(HANDOFF.md rule 2)."* Protocol used is HANDOFF.md's verbatim: 70/30 by session
date, `B` refit per variant on train only, evaluated on test only, paired
bootstrap clustered by session.

**The vol-forecast gain replicates.** Spearman of `M` against the session's own
realised per-minute RMS, test half, 805 sessions: shipped **0.4372** → perMin
**0.4704**.

**It does not carry to the probability:**

| variant | B (refit on train) | test Brier | test logloss |
|---|---|---|---|
| shipped | 1.4756 | 0.153527 | 0.462696 |
| perMin | 1.6029 | 0.153199 | 0.462222 |

`dBrier = −0.000329`, 95% CI clustered by session **[−0.000978, +0.000317]** —
clears the standing 0.0002 noise band on the point estimate, spans zero on the
interval. **Not established. Not shipped.** Gate 2 is moot.

**Rule 2 confirmed empirically rather than taken on trust.** Scoring the perMin
`z` with the shipped `B = 1.49` — the naive swap — gives test Brier `0.153498`
against `0.153507`. **Nine millionths.** `B` must move 1.4756 → 1.6029 for the
estimator change to register at all, because perMin sigma sits on a different
scale and `B` absorbs almost the whole effect on refit. Swapping the estimator
without re-fitting `B` would have shipped nothing but a miscalibration.

**The honest statement is not "no effect"** — it is that the better volatility
forecast is real and the probability layer **structurally cannot convert it**.
`sigmaUnit` weights the trailing term at 0.6, `sigmaCur` carries the rest from
live within-session data, and the logistic absorbs the residual scale change
into `B`.

---

## 3. THE BAND WAS NEVER CHECKED — and 90%+ is a confirmed loser

Terry: *"r ur returns still only bettering in between 60-89?"*

The 60–89% band was never derived. Sweeping 15 bands at $5/bet:

| band | bets | rate | model claimed | edge | ROI | 95% CI |
|---|---|---|---|---|---|---|
| 50–100% | 37,408 | 77.1% | 76.3% | +0.7pp | −0.90% | [−2.08, +0.26] |
| **60–69%** | 7,307 | 66.3% | 64.2% | **+2.0pp** | **+0.06%** | [−2.33, +2.40] |
| 60–79% | 13,127 | 70.4% | 68.7% | +1.7pp | −0.44% | [−2.47, +1.52] |
| 60–89% | 18,440 | 74.6% | 73.3% | +1.3pp | −0.60% | [−2.33, +1.16] |
| 70–79% | 5,820 | 75.6% | 74.4% | +1.2pp | −1.06% | [−3.33, +1.28] |
| 80–89% | 5,313 | 84.9% | 84.5% | +0.4pp | −1.02% | [−2.87, +0.79] |
| **80–100%** | 16,408 | 92.6% | 92.9% | −0.3pp | −1.28% | **[−2.20, −0.36]** |
| **90–100%** | 11,095 | 96.2% | 96.9% | −0.7pp | −1.41% | **[−2.08, −0.76]** |
| **95–100%** | 8,258 | 97.8% | 98.6% | −0.8pp | −1.37% | **[−1.91, −0.86]** |

**The model's edge decays monotonically with its own confidence and goes negative
above 90%.** 60–89% is beaten by 60–79% and by 60–69%.

**Those three bolded CIs exclude zero.** They are not "indistinguishable from
break-even" — they are established losses. Mechanism is arithmetic, not
statistical: at 98¢ all-in you risk 98¢ to make 2¢, so a 0.8pp miscalibration is
trivial in probability terms and fatal in ROI terms.

**No band is confirmed profitable.** The best straddles zero.

---

## 4. Position in the session — and the cleanest demonstration of selection bias

Terry asked for 1st/2nd/3rd five-minute blocks, then for k5-7 / k7-9 / k9-11.

**Blocks, 60–89% band, $5/bet:**

| block | bets | rate | claimed | edge | ask | P&L | 95% CI |
|---|---|---|---|---|---|---|---|
| 1st 5 min | 8,028 | 71.4% | 70.3% | +1.0pp | 72.2¢ | −$498.89 | [−3.61%, +1.11%] |
| 2nd 5 min | 7,532 | 76.8% | 75.1% | +1.7pp | 76.8¢ | +$41.82 | [−2.08%, +2.18%] |
| 3rd 5 min | 2,880 | 77.8% | 76.8% | +1.0pp | 78.5¢ | −$99.10 | [−3.46%, +2.02%] |

The first five minutes carry ~90% of the loss. Reads run k=1..14 so the third
block holds four minutes, not five.

**The three windows — and the finding that matters:**

| window | bets | edge | ROI | train | test |
|---|---|---|---|---|---|
| k5–7 | 5,143 | +1.3pp | −0.69% | −2.04% | **+2.55%** |
| k7–9 | 4,535 | +1.5pp | −0.14% | −1.30% | **+2.60%** |
| k9–11 | 3,736 | +2.5pp | **+1.29%** | +1.56% | +0.70% |

**k9–11 wins by a wide margin in sample and is the WORST of the three out of
sample.** Choosing it off the full-sample column — exactly what reading the
per-minute table invites — selects the weakest performer going forward. Of 90
contiguous windows, the in-sample #1 (k10–11, +1.58%) turns **negative** out of
sample at −0.54%. In-sample rank does not predict out-of-sample sign.

Sign flips of 4–5 points between halves swamp every difference between windows.

**Non-overlapping partition** — two cells hold their sign in both halves:

| window | edge | ROI | train | test |
|---|---|---|---|---|
| **k9–10** | **+2.4pp** | +1.15% | +0.85% | +1.84% |
| **k13–14** | **−1.0pp** | −3.21% | −2.23% | −5.59% |

**k13–14 is the credible one and it is negative.** It is the only window where
the model is *over*-confident (claims 77.1%, delivers 76.1%), and it has a
mechanism documented **before** this test ran: defect 9's minute-14 factor is
non-monotonic and re-widens over the final 20 seconds because settlement averages
60 RTI prices the tool never sees. Consistent sign in both halves **plus** a known
cause. 908 bets, CI [−7.25, +0.81] — still not established alone, but it is the
best candidate on the board and it says **stop betting in the last two minutes**.

---

## 5. The $5 flat-stake answer

`--stake=5`, 60–89%, one bet per minute, either side:

- 18,440 bets across 2,666 sessions, **$92,200 staked**
- 13,754 won — **74.6%** against a claimed 73.3%
- **NET −$556.17 (−0.60%)**, 95% CI **[−2.43%, +1.08%]** → **−$2,242.40 to +$994.42**
- Integer contracts: −$502.68 on $84,747.68 deployed (−0.59%)
- **Fees $2,274.51. At zero fee this is +$1,718.34.**

**The CI spans zero.** The loss is not distinguishable from break-even. The model
wins more often than it claims; the fee is simply bigger than the surplus.

Default `--stake=10` reproduces every previously published figure to the cent
(−$1,112.35 whole set, −$1,391.20 night, +$278.85 rest of day), so nothing
already in #41 moves.

---

## 6. Live diagnosis — the 19¢ phantom, and why the band rule was not enough

Terry logged a read at 03:36Z on the 3:30–3:45 session and the tool claimed
**+19¢ on NO**. The implausible-edge guard fired. **The side entry was correct** —
Kalshi showed UP 87¢, he typed 87 with the toggle on YES.

**The 19¢ was a stale-volatility artifact, and it is fully explained:**

| | |
|---|---|
| model said | UP 65% |
| Kalshi said | UP 88% |
| model's σREM | **$67.4** |
| σREM implied by Kalshi's price | **≈ $21** |

Reverse-engineered: with Δ = +$28 and `B = 1.49`, a price of 88% implies
`z = 1.337`, hence σREM ≈ $20.9. **The model believed the market was 3.2× more
volatile than Kalshi did.** Change only σ and the 22-point disagreement vanishes
entirely.

**Cause, visible on his own screen:** `σ live — this session: needs 2 reads` and
`σ trail — M 1.00 (n0)`. Both volatility inputs were inert, so `sigmaUnit` fell
back to the raw hour-3 baseline of **$25/min** — a number describing an average
3am, not that one. His previous session had logged σ live at **$1.0/min**.

**The evidence rail cannot catch this.** It read `n=502 · up 64% · 60–67% Wilson`,
which looks like independent confirmation. It is not — those analogs are
**z-matched**, selected on the same z the wrong σ produced. It inherits the error.

**This is why my band rule failed.** It compares the ask to the bottom of the
Wilson band. Here that band was tight and confident **around a mis-centred
distribution**, so the rule said take the trade. The check that must come first:

> **Is the model running on live data at all?** If `σ live` says "needs reads" or
> `M` shows `n0`, its confidence is untrustworthy in both directions and no band
> drawn around it means anything.

Corollary given to Terry as a standing rule: **any double-digit gap is a stale σ,
not an edge.** The measured honest edge is ~1pp.

**Also relevant:** the "calibrated to ~1pp" result was measured across 2,688
sessions **with M working**. With M inert the tool is outside the conditions its
calibration was ever established under.

---

## Judgment calls

- **Left #42 as a draft.** Terry promoted #41 himself when he wanted it in. Marking
  my own PR ready is his call, not mine.
- **Updated #42's body mid-session** when three commits landed after it was
  written. The description understating the diff is a real defect in the record;
  the title changed with it.
- **Rewrote the queued check-in twice rather than letting it fire stale.** The
  07:33Z version still asserted "the taker fee was the entire binding constraint",
  which the maker backtest had disproved twenty minutes earlier. A scheduled
  message is the anchor for a cold session, so firing it unedited would have
  handed a future session a confidently-wrong conclusion with no retraction
  attached. Consolidated three redundant check-ins into one.
- **Did not fix defect 11 or 12.** Both change or restore model instruments and
  neither was the question in front of me.
- **`--stake` rather than a forked script.** Default unchanged, so the published
  numbers still reproduce from the same file.
- **Reported k9–11 honestly rather than dismissively.** It is positive in both
  halves. It still fails, but for a reason that had to be measured (rank
  instability across 90 windows), not assumed.
- **No Linear tickets.** BTC Session Edge remains off the board — open Terry
  decision since S38. The Linear MCP also required re-authentication late in the
  session and was unavailable; it would not have changed anything.

---

## Defects — state at end of session

| # | Defect | State |
|---|---|---|
| 13 | Market price had no side; `gapOf()` inverted the trade | **FIXED in #41, merged** |
| — | Implausible-edge guard (~15¢) | **SHIPPED in #41** — closes S40 pending item 3 |
| 11 | `shadowRead()` passes `net: null`, so the trend term is off in every shadow row and in `B`/Brier/hit-rate measurement | **OPEN** `[UNVERIFIED — recalled from S40, not re-checked this session]` |
| 12 | `compactShadow()` strips `ab` on resolve, so the shadow ablation panel reads `needs 30 more rows` forever | **OPEN** `[UNVERIFIED — recalled from S40, not re-checked this session]` |

---

## Pending Terry actions

| # | Action | Why it needs you |
|---|---|---|
| 1 | **Merge #42** | Five commits of measurement, CI 4/4 green, no model change. Left draft deliberately. |
| 2 | **Decide on the server-side Kalshi proxy** | **Highest leverage item, unchanged since S40.** Four routes are closed. The gap against a real quoted price is the only one left, and it cannot be measured from the baked data, which has no Kalshi prices at all. |
| 3 | **Resolve your logged sessions** | `M = 1.00 (n0)` is not a bug — `mult()` needs **4 resolved sessions** and you have five logged with zero settled. Until they resolve, σ runs on a generic hour baseline and will keep producing phantom double-digit gaps like the 19¢. Use the settle buttons on the bottom bar. |
| 4 | **Fix defect 12?** | One line, keeps `ab` in the compacted row. Restores the shadow ablation panel. Offered since S40, still awaiting yes/no. |
| 5 | **Decide whether BTC Session Edge goes on the Linear board** | Open since S38. Four sessions of defects tracked only in `docs/`. |
| 6 | **Decide on defect 11** | Every calibration number was measured with the trend term disabled. |

---

## Verified facts — do not re-prove these

- **`main` = `8c543bf`**; #40 and #41 merged 07:04Z; production deploy
  `dpl_CQqpPb5QrEEqNWWHC7hsrrAjGFL8` at 07:04:48Z. Verified by content — squash
  merges make ancestry checks lie.
- **Latest build:** `https://ai-thesis-v2.vercel.app/btc-session-edge-v3.html`,
  **behind the app login** (307 → `/login` unauthenticated). Byte-identical to
  local `btc-session-edge-v3/index.html` — **506,858 bytes, md5
  `08a60988168c53d8c41e5f6d0f431bd1`**.
- **The log lives in `localStorage`** (`STORE` in `src/app.html`), which is
  per-origin. A local file and the live URL keep **completely separate logs**.
  Rows do not follow you between them.
- **`mkt ¢` entry:** **YES = UP, NO = DOWN**, matching Kalshi's own contract.
  Type whichever price you are reading and set the toggle to match; `mktYes()`
  does `100 − v` when the toggle is NO. That toggle is the defect-13 fix and is
  the one input the tool cannot self-check.
- **`driftNudge` is hard-zero from minute 8** — `max(0, (8−k)/8)`. A displayed
  `DRIFT −$38` at k=12 is shown but not applied, and the `D` ablation correctly
  reads 0.0pp.
- **`ceilings()` maker column is a trap on this series.** Maker fees are free
  (M=0) so the maker ceiling is the raw probability, but resting orders carry
  ~13¢ of adverse selection. Ignore that column.

---

## Verification

| check | result |
|---|---|
| `flat-stake-strategy.mjs` self-checks | **14/14 pass**, and `--stake=10` reproduces every published figure to the cent |
| `bundle.mjs verify` | `roundTripIdentical`, `bundleMatchesSrc`, `deployedMatches` all true |
| PR #42 CI | **4/4 green** — Vercel Preview Comments, Web typecheck (tsc), Engine tests (supabase/_shared), Engine tests (Python) |
| CI methodology | all bootstraps clustered **by session**, 4,000 resamples, `mulberry32` |
| pipeline consistency | all three new scripts reuse `calibration-replay.mjs`'s `shadowRead()` reconstruction verbatim — same `B`, `mult()`, `sigmaFromPts()`, `REMVAR[k−1]`, fee rounding, flat-session exclusion |

**Note on `bundle.mjs verify`:** `deployedMatches` compares the two copies **on
disk only** — it never touches Vercel. The live side was confirmed separately via
the deployment record. I stated this imprecisely earlier in the session and
corrected it.

---

## Standing caveats on everything above

- **In-sample at the calibration layer.** `B = 1.49` was fitted on these same
  2,688 sessions. Splits are out-of-sample in **time**, not in **regime** — 28
  days, Jul 8 – Aug 4 2026, one regime.
- **The fill is assumed, not observed.** Every backtest pays the model's own
  probability plus the taker fee. That assumes the book quotes exactly what the
  model thinks, i.e. **zero edge before fees by construction**. It is the
  pessimistic-but-honest choice. It also means **none of this measures a real gap**.
- **`SESS` has no volume field.** Any volume-conditioned work needs new data.

---

## Skills loaded this session

**None.** CLAUDE.md requires `/subagent-driven-development`,
`/dispatching-parallel-agents`, `/verification-before-completion`, `/lambo`,
`/linear`, `/ferrari`, `/frontend-design`, `/ui-ux-pro-max`, `/honesty` at session
start. This session began mid-flight from an existing context rather than at a
cold start, and they were not loaded. Recording it rather than papering over it —
S40 had the same gap.

---

## Next in build order

Not a THS ticket. In priority order:

1. **The Kalshi price path.** Everything is downstream of it. Four routes closed;
   the gap is the only one left and it is unmeasurable without real quotes. A
   small server-side proxy removes the manual `mkt ¢` step and lets shadow mode
   score gaps unattended.
2. **Get sessions resolving** so `M` wakes up. Cheap, and it stops the phantom
   double-digit gaps that currently make the GAP tab unusable live.
3. **Defect 12, then defect 11** — both cheap, both restore instruments that
   currently mislead by omission.
4. **k13–14 as the one candidate worth another look** — consistent sign in both
   halves and a documented mechanism. Not a strategy; a hypothesis with a prior.

**Do not** propose another probability filter. Four independent closures and a
5,292-rule back-solve that failed its null say the answer is not in the
probability, in the trend, in the execution style, or in any conditional slice of
them.

---

## Recommendations for next session

**The tool is now correct, well-tested, and still has nowhere to send its
readings.** That has not changed since S40 — what changed is that the list of
places the edge *could* have been hiding is now four items shorter, and the
remaining one is blocked on a single decision.

**Concretely:**

1. **Get the Kalshi proxy decision.** If yes, that is the whole next session. If
   no, the GAP tab only fills when Terry hand-types `mkt ¢`, and the next useful
   measurement is ~200 gap-logged signals away — weeks of manual work.
2. **Read §6 before touching anything live.** The 19¢ phantom will recur on every
   session until `M` has resolved sessions to work from, and the evidence rail
   structurally cannot warn about it.
3. **If asked for another filter, point at this file.** The honest answer is that
   the question has been asked four ways and answered four times.

For AI Thesis proper: **nothing has moved since S36.** S36's recommendation stands.

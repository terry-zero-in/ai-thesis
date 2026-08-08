# S40 — BTC Session Edge: remaining time, the gap log, and the end of the probability thesis

**Date:** 2026-08-07 · **Branch:** `claude/btc-edge-remaining-time-68fe9v` · **HEAD:** `0461975` · **4 commits ahead of `origin/main`** (`8db1b40`) · **PR [#40](https://github.com/terry-zero-in/ai-thesis/pull/40)** open, draft, CI 4/4 green, zero review comments

**Continuation of S39** (`docs/2026-08-07-S39-btc-edge-live-operation-defects.md`) — note that S39's doc lives on the **unmerged** `claude/btc-edge-v3-calibration-7wceyz` branch behind PR #39, so it is **not on `main` and not in `docs/handoffs/`**. The handoffs directory jumps S38 → S40 for that reason. Read S39 from the branch or from the handoff zip.

---

## HEADLINE — read this before building anything else on this tool

**There is no edge in the model's probability at any confidence level, and the day's live results that suggested otherwise were luck.**

Terry ran the tool against live Kalshi for ~9 hours. After 15 shadow sessions / 209 reads the model looked strongly under-confident — 13–17pp in the 60–90 bands, implying a hypothetical +21% on turnover. That was the basis of three separate answers given mid-session.

Replaying the exact `shadowRead()` pipeline over all 2,688 baked sessions — **37,408 reads** — kills it:

| band | bets | actual | breakeven after fees | edge |
|---|---|---|---|---|
| 50–54% | 3,900 | 54.1% | 54% | +0.2pp |
| 55–59% | 3,973 | 57.8% | 59% | −1.2pp |
| 60–64% | 3,922 | 63.9% | 64% | +0.0pp |
| 65–69% | 3,385 | 69.0% | 69% | +0.1pp |
| 70–74% | 3,000 | 73.0% | 74% | −1.0pp |
| 75–79% | 2,820 | 78.3% | 79% | −0.6pp |
| 80–84% | 2,645 | 82.8% | 84% | −1.2pp |
| 85–89% | 2,668 | 87.0% | 88% | −0.9pp |
| 90–94% | 2,837 | 91.7% | 93% | −1.4pp |
| 95–100% | 8,258 | 97.8% | 100% | −1.8pp |

Overall mean stated **76.3%** vs actual **77.1%** — a gap of **+0.7pp**, not 15.

**Consequences, recorded so they are not re-derived:**
- **No split of the 60s** (Terry asked). 60–64 → +0.0pp, 65–69 → +0.1pp. No structure to divide.
- **No profitable band and no profitable filter** — not 55–85%, not 60–89%, not "confirmed dips" (a 50s read on the same side as an earlier 60%+ read in the same session).
- **A calibrated model betting at its own price loses to fees by construction.** That is what calibration means.
- **This is the quantitative form of Terry's own S39 framing** — *"the gap is the product."* Only divergence from Kalshi's **quoted price** can pay.

**Caveat, load-bearing: the replay is IN-SAMPLE.** `B = 1.49` was fitted on these same 2,688 sessions, so near-perfect calibration is partly what fitting produces. It does **not** establish out-of-sample calibration. It removes any basis for *claiming* an edge, since an edge would have to appear here first. The only out-of-sample evidence is the 209 live reads, which are ~15 effective observations because reads inside a session almost all resolve together.

**What this means for the next session: stop tuning the probability. The binding constraint is that `mkt ¢` is manual, so the GAP tab has no data.**

---

## Operating posture — Terry's directives this session

- **Minute-14 decision (the one thing S39 deliberately did not decide):** Terry chose **option B+** — the settlement-average shrink `REMVAR[13] × ((1−f)³ + f³/4)` — over straight-line interpolation and over the cube alone. Shipped in `add4487`.
- **Plain English with worked numbers, not jargon.** Reinforced repeatedly. When Terry says "I still don't understand," the previous answer was too abstract; the fix is a concrete worked example, not a rephrase.
- **He asks for the ledger in dollars.** Repeated requests for "what would I have made at $10/minute" under various filters. Those are decision aids, not idle curiosity — answer them exactly, and state when a number is an estimate.
- **He caught a real gap in my own reasoning** by asking whether `mkt ¢` is "always the higher of the two or the Up amount." It is always **Up**. Entering Down flips the recommended side *and* inflates the edge from +7¢ to +71¢ silently.

---

## What shipped — 4 commits

**`3364c6c` — The model is direction-blind, and its one trend term is switched off.**
Answers *"IS our data even doing the equivalent of looking at the up/down trends to estimate?"* — **almost no.** `model()` carries a sign only through `driftNudge`; every volatility input uses `abs`/squares/RMS, discarding the sign before use. `driftNudge` is ≤4.8pp, hard-zero from minute 8, needs a `px75` anchor only the traded store builds, and `shadowRead()` passes `net: null` **hard-coded** — verified by `p` and `ab.noDrift` returning bit-identical `0.372908`. Tested Terry's premise on the baked set: **"4 up sessions → next is down" is not in the data** (52.6% and 54.5%, same side of 50% ⇒ noise); the **dollar size** of the 5-session net move *is* a real ~5–6pp fade, which is what `driftNudge` already encodes. Adds `analysis/trend-signal.mjs`.

**`add4487` — Defects 9 and 10: the model's clock now ticks inside the minute.**
`remVarAt(D, k, sec, settleAvg)` replaces the whole-minute `REMVAR[k-1]` lookup. Minutes 0–13 drain linearly; minute 14 uses B+. At `f=0` the bracket is 1, so it is **exactly continuous** with the baked tables — asserted for all k on both bases, so no prior fixture re-bases and `B` is untouched. Minute 0 now prices (defect 10). `rail()` declines at k=0 rather than comparing the live z against `SESS` column 0, which is the sigma field — it returned **n=2687 of garbage** before. Adds `tools/clock.mjs`.

**`2191d51` — The gap log.**
New **GAP tab**: `gapOf()` / `gapPnl()` / `gapRows()` / `gapAgg()`. Headline is **claimed edge vs realised**. **Nothing new had to be recorded** — every logged read already carried `mktCents`, `yesT`, `noT`, so the track record builds retroactively from reads taken before the view existed. **Losses are rows**, pinned by a browser assertion. On TRADE the edge is now a number in its own bar (`+16¢ · BUY YES ≤ 56¢`). Adds `tools/gap.mjs`.

**`0461975` — There is no edge in the probability at any confidence level.**
The replay above. Adds `analysis/calibration-replay.mjs` and section G of the S40 analysis doc.

---

## Judgment calls

- **Branch based on `main`, not stacked on PR #39.** #39 is open and edits `src/app.html`, but its hunks are confined to `fetchShadow`/`armFromCandles`/`persistShadow` — verified — while S40 touches `model`/`read`/`shadowRead`/`rail`/`remVarAt`. Zero overlap, so the two merge in either order and #40's diff does not replay #39's work.
- **Shipped the minute-14 non-monotonicity as chosen, and surfaced it.** The B+ factor bottoms at `f=2/3` (1/9) and **rises back to 1/4** at the close, so the probability visibly re-widens over the final 20 seconds. That is real — settlement averages 60 prices the tool never sees. An assertion demanding monotonicity across all 15 minutes **failed at k=14 and was wrong**; the assumption was mine, not the model's. Replaced with assertions pinning the exact shape.
- **Kept the shadow loop's `k >= 1` guard** even though `read()` now admits minute 0. The traded strike is Kalshi's target, so a minute-0 delta is real; shadow's synthetic strike **is** the session open, so its minute-0 delta is zero by construction and would log a guaranteed `p=0.5` row every session — no information, but it inflates `n` and flattens the calibration curve.
- **Held back the `M` estimator finding.** `mult()` builds `M` from `|finalDelta|` — one number per session. The same construction from realised per-minute vol scores **0.527 → 0.621**, and shortening the window makes it *worse*, so the estimator is the problem, not the lookback. Not shipped: `sigmaUnit` feeds `z` and `B` was fitted to `z` (HANDOFF.md rule 2), and RMSE on a vol forecast is not Brier on outcomes.
- **Reverted `trade-tab-1440x900.png` once, kept it the second time.** Running `selftest.mjs` regenerates it as a side effect; the first run changed nothing visual so the diff was noise, the second run legitimately captured the new edge bar.
- **Filed no Linear tickets.** Verified via `list_issues` that **no BTC Session Edge ticket exists on the THS board**. S38 and S39 both recorded that whether this project gets formal tracking is Terry's decision; creating tickets would make that call for him. Deferred items are recorded below instead.

---

## Defects found but NOT fixed this session

| # | Defect | Evidence | Fix |
|---|---|---|---|
| **11** | **Shadow runs with the trend term hard-coded off.** `shadowRead()` passes `net: null`, so the `D` ablation column is bit-identical to the main column in every shadow row, and `B=1.49`, the Brier and the hit rate were all measured with the directional term disabled. | `p` and `ab.noDrift` both `0.372908` in the harness | Decide whether shadow should backfill `px75` — `armFromCandles()` already proves the Coinbase candle endpoint retrieves past session opens |
| **12** | **The shadow ablation panel is structurally dead.** `compactShadow()` strips `ab` the moment a session resolves, and the panel filters on `x.ab`. A row is only *scored* once resolved, so the qualifying set is empty **by construction** — the panel reads `— · 0/0 · needs 30 more rows` forever, at any n. Confirmed on Terry's screen at n=54, n=68 and n=96. `M`, `S` and `X` should each have ~96 rows; only `D` is legitimately zero (that is defect 11). | Reproduced in the harness: `compactShadow()` output has no `ab` key; filter yields 0 for all four variables | One line — keep `ab` at 3dp in the compacted row. ~60 bytes/row against a 5MB quota `pruneShadow` already caps |

---

## Linear management

**None.** No THS ticket was touched. Verified by search that BTC Session Edge has no ticket on the board. Whether it gets formal tracking is a standing Terry decision, open since S38.

---

## Prod database state at end of session

**Unchanged.** No migrations, no writes, no schema work. `hp1.*` exactly as S36 left it. Shadow mode and the gap log write to browser `localStorage` only.

---

## Commits pushed

```
0461975 There is no edge in the probability at any confidence level
2191d51 The gap log: what the tool claimed, and what it actually booked
add4487 Defects 9 and 10: the model's clock now ticks inside the minute
3364c6c The model is direction-blind, and its one trend term is switched off
```

---

## Verification

| check | result |
|---|---|
| `tools/behaviour.mjs` | **212/212** (38 new S40 assertions) |
| `tools/gap.mjs` — real browser | **16/16** |
| `tools/clock.mjs` — real browser, controlled clock | **9/9** |
| `tools/selftest.mjs` — real browser | **20/20** in-artifact + 3 layout + 10 grouped-log |
| `tools/bundle.mjs verify` | round-trip, src, deployed copy all in sync |
| `analysis/trend-signal.mjs` | regenerates every figure in the trend audit |
| `analysis/calibration-replay.mjs` | regenerates the 37,408-read table |
| PR #40 CI | 4/4 green |

**`tools/clock.mjs` and `tools/gap.mjs` are new and they matter.** Both defects and the whole GAP tab are page-level, and the Node harness structurally cannot see them — it builds with `props={}` and applies `setState` synchronously. Both drive the real page with `Date.now` replaced before any app code runs. Measured in the browser at a $10 gap: **minute 13 moves 69% → 81%** across one minute where it was frozen (σ_rem $18.5 → $10.2); **minute 2 holds 56%** while σ_rem still ticks $67.1 → $64.4; **minute 0 shows 55%** instead of refusing.

Every assertion was written first and watched fail.

---

## Pending Terry actions

| # | Action | Why it needs you |
|---|---|---|
| 1 | **Merge #40** (and #39) | Production still serves the **pre-defect-9/10 build** — `main`'s `web/public/btc-session-edge-v3.html` is 481,226 bytes vs 500,482 locally. No GAP tab, minute 0 refuses, minute 14 is 15.8pp wrong. Merging to `main` is a production change; not done unilaterally. |
| 2 | **Fix defect 12?** — one line, keep `ab` in the compacted row | Offered, awaiting yes/no. Restores the ablation panel for `M`, `S`, `X`. |
| 3 | **Add an implausible-edge guard (~15¢) to the TRADE tab?** | Offered, awaiting yes/no. Entering the Down price in `mkt ¢` flips the side and prints +71¢ with no complaint. Kalshi's spread is ~1¢, so double-digit edge is almost always an inverted input. |
| 4 | **Decide on a server-side Kalshi proxy** | **This is the highest-leverage open item.** `mkt ¢` is manual because Kalshi's API is closed to browsers. Until it isn't, the GAP tab only fills when you hand-type, and shadow can never score a gap at all. Everything the replay proved says this is the only path to a measurable edge. |
| 5 | **Decide whether BTC Session Edge goes on the Linear board** | Open since S38. Three sessions of defects are tracked only in `docs/`. |
| 6 | **Resolve the stale traded reads** — `4:30–4:45a`, 2 reads, unresolved all day | They can never reach GAP until settled up/down. |
| 7 | **Decide on defect 11 and the minute-14 accumulation** | Both change the model. Defect 11 means every calibration number was measured with the trend term off. Accumulating elapsed prices makes the minute-14 factor `(1−f)³`, monotonic to zero, removing the last-20-seconds re-widening. |

---

## Next in build order

**Not a THS ticket** — BTC Session Edge is off the board. The natural next unit of work, in priority order:

1. **The Kalshi price path (pending item 4).** Everything else is downstream of it. A tiny server-side proxy would remove the manual `mkt ¢` step and let shadow mode score gaps unattended, which is the only way to get a real out-of-sample edge measurement.
2. **Defect 12**, then **defect 11** — both are cheap and both restore instruments that currently lie by omission.
3. **The `M` estimator**, only with a Brier measurement and independent replication (HANDOFF.md rule 2).

For the AI Thesis build proper: **nothing has moved since S36.** S36's recommendation still stands.

---

## Verified facts — do not re-prove these

- **PR #40** is on `claude/btc-edge-remaining-time-68fe9v`, based on `main` @ `8db1b40`, **not** stacked on #39. #39's `src/app.html` hunks are confined to `fetchShadow`/`armFromCandles`/`persistShadow` — no overlap with S40's functions.
- **Production is behind two walls.** `ai-thesis-v2.vercel.app/btc-session-edge-v3.html` 302s to `/login?next=…` (title *"Sign in · AI Thesis"*), and the #40 preview URL is behind **Vercel SSO**. Neither is fetchable from a session container. The bundle is self-contained and runs off disk over `file://` — that is the fastest way to hand Terry a build.
- **`mkt ¢ (YES)` is always Kalshi's *Up* price on the Target Price row**, never "the higher of the two." When spot is below the strike, Up is the *lower* number.
- **Kalshi's two BTC 15-min products are still easy to confuse** (S39's warning holds). The middle `Target Price: $X · Chance N%` row is what this tool prices; the right-hand "BTC Up or Down – 15 minutes" panel is a different bet.
- **Shadow can never populate `mkt ¢`.** Kalshi's API is closed to browsers, so shadow has no market price to disagree with. Stated in the GAP footer.
- **`SESS` has no volume column** — 16 columns: one σ and 15 cumulative deltas. Any volume-conditioned work needs new data pulled first.
- **The baked data is 1-*minute* bars**, so true within-minute-14 behaviour **cannot** be measured from this file. That needs second-resolution data.
- **Reads within a session are not independent.** They almost all resolve together, so `n` reads across `s` sessions is closer to `s` observations. The scorecard's `hitsV / scV.length` does not adjust for this.
- Everything in S37/S38/S39's verified-facts blocks still holds.

---

## Skills loaded this session

**None.** Stated plainly rather than claimed: the session opened with a specific task handoff (read S39, confirm the defect-9 table, ask the minute-14 question) rather than a general build kickoff, and the environment's instructions disallowed agent/workflow tooling unless requested. CLAUDE.md's standing rule asks for `/subagent-driven-development`, `/dispatching-parallel-agents`, `/verification-before-completion`, `/lambo`, `/linear`, `/ferrari`, `/frontend-design`, `/ui-ux-pro-max`, `/honesty` at session start — **a fresh session should load them.**

---

## Recommendations for next session

**Stop improving the probability. The replay closed that avenue.**

The honest state of this tool: it is a well-built, well-tested, correctly-calibrated short-dated binary pricer that agrees with Kalshi to within a point and **cannot make money on its own output**. Four sessions of defect-hunting have made it *right*; none of that made it *useful*, because usefulness was never a function of the probability's accuracy.

The one thing that would change that is a real Kalshi price on every read. Everything else — defect 11, defect 12, the `M` estimator, minute-14 accumulation — is polish on an instrument whose readings currently have nowhere to go.

**Concretely, in order:**
1. **Ask Terry to merge #40** so the fixes are actually live. Right now he is trading against a build with a 15.8pp minute-14 error.
2. **Get a decision on the Kalshi proxy.** If yes, that is the next session's whole job. If no, then the GAP tab needs Terry hand-typing `mkt ¢` on every read, and the next useful measurement is ~200 gap-logged signals away — weeks of manual work.
3. **Fix defects 11 and 12 while waiting** — both cheap, both restore instruments that currently mislead.

**Do not** re-run the "is the model under-confident" analysis. It is committed, it is settled at 37,408 reads, and re-deriving it from a fresh live sample will produce another lucky-looking number.

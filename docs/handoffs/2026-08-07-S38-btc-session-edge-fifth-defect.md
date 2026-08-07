# S38 — BTC Session Edge v3: the fifth defect, and why the test for it was blind

**Date:** 2026-08-07 · **Branch:** `claude/btc-edge-v3-calibration-7wceyz` · **PR:** [#38](https://github.com/terry-zero-in/ai-thesis/pull/38) (open, draft) · **HEAD:** `503b07d` · Continuation of S37 by subject: the BTC artifact, not the AI Thesis build.

---

## HEADLINE

**S37 closed by recommending a test: let shadow mode run, then check whether displayed 80% reads hit ~80%. That test returns a false all-clear.** There were three more defects, and two of them cancel *inside shadow mode specifically*.

| # | Defect | Direction | Found by |
|---|---|---|---|
| 5 | **`B` shipped at 1.77, not 1.49** — `data-props` declared the default; the DC runtime injects declared defaults as props, so `activeB()`'s `?? 1.49` fallback never fired | traded dial **overconfident ~4pp** at 80–90 | code path trace, confirmed by browser render |
| 6 | **Shadow computed `M` from the traded log** — `mult()` read `this.state.sess`, which shadow never writes | shadow's `M` **pinned at 1** forever; a shadow read moved 7.68pp on identical inputs when a *traded* session resolved | code path trace, confirmed by driving the real methods |
| 7 | **Scorecard + CALIBRATION panel always read the traded log**, in both modes | the instrument for the question **could not see shadow data** | browser: 40 shadow reads at 85% conf, all wrong → `n0` in every band |

**Defect 5 is defect 4, unfixed.** #35 changed `activeB()`'s fallback and the footer string from 1.77 to 1.49 and never touched the declared `data-props` default. The browser ran the pre-#35 slope for two sessions.

### Why the proposed test was structurally incapable of finding it

`B = 1.77` was fitted on a basis with `M` pinned at 1. Defect 6 pins `M` at 1 in shadow mode. **Shadow was running exactly the pipeline 1.77 was calibrated for.** Meanwhile the traded dial ran `M` live at `B = 1.77` — which is precisely defect 4.

Measured by replaying the real `shadowRead` / `model` / `mult` / `sigmaFromPts` methods (no reimplementation) over the 2,688-session baked set — one read per minute, causal σ chain, close-tick outcome, 70/30 split by session date:

| Configuration | displayed 80% → actual | 80–90 band | Brier (test) |
|---|---|---|---|
| **What shadow ran** — B 1.77, M pinned 1 | 82.9% | 85.0 → 85.2 (+0.2) | 0.15464 |
| **What the traded dial ran** — B 1.77, M live | **76.2%** | 85.1 → **81.2** (−3.9) | 0.15428 |
| **After the fix** — B 1.49, M live both sides | **80.3%** | 85.0 → 84.7 (−0.3) | **0.15386** |
| (B 1.49, M pinned 1 — for completeness) | 85.4% | 84.9 → 88.2 (+3.3) | 0.15581 |

The middle row independently reproduces S37's own defect-4 number — they measured the 80–90 band at **81.7%**, this replay gets **81.2%**. That agreement is what establishes the replay is faithful rather than a new model with its own opinions.

**The lesson, stated plainly: a paper-trading mode that does not run the same pipeline as the live dial validates nothing, and will report success loudest exactly when the live dial is broken. Two bugs cancelling is not calibration.**

### The defect class, and why 145 assertions missed it

Defect 5 passed the suite *because* `behaviour.mjs` constructs the component with `props = {}` — the one condition under which the dead fallback fires. The tests measured 1.49; the page rendered 1.77. **Any constant that reaches production through a framework-supplied default is invisible to a harness that supplies no props.** `feeK`, `makerMult` and `macroSigmaMult` arrive by the same route.

It was also visible on screen the entire time. The footer rendered:

```
B=1.77 ruled · refits at n≥150 (0) · baked-data refit 1.49 on the live M pipeline · M=1.00
```

— contradicting itself on one line, next to a pinned `M`. Nobody read it, including me until I rendered the page in a browser rather than reasoning about the source.

---

## What shipped

`B_RULED = 1.49` declared once and read by all three consumers (the `data-props` default, `refitB()`'s Newton seed, `activeB()`'s fallback). `mult(D, src)` takes its session source as a parameter; `shadowRead` passes `shadowSessions()`, built from shadow's own resolved rows with the CT hour derived from `sessionTs` rather than stored, so pre-existing rows still count. Scorecard, CALIBRATION panel, ablation aggregate and footer follow the visible log and name it (`· SHADOW` / `· MY LOG`). The `M` tile reads `inert — needs 4 sessions (n…)` while `M` is pinned. Shadow rows tagged `v: 3`; the status line names pre-v3 rows as a superseded engine rather than pooling two dials into one chart.

`scored()` is deliberately unchanged — it feeds `refitB()`, and a paper run must never move the constant the traded dial runs on. The view gets its own scoped set instead.

**No model constant was changed on new evidence.** `1.49` was already decided, measured and documented as shipped in #35; this makes the artifact apply it. Nothing from the external review ships here.

---

## Judgment calls

**Treated "make the artifact apply 1.49" as a defect fix, not a constant change.** Terry's standing instruction is not to change model constants without independent verification. The constant was not re-derived here: it was decided in S37. What I did verify independently is that the *shipped* combination was wrong and the *intended* one is right — the replay above, whose middle row reproduces S37's measurement to 0.5pp.

**Shipped nothing from review round 3.** Perplexity's round 3 (delivered mid-session) withdrew the per-k blend schedule, γ interaction and weekend multiplier as basis artifacts — conceding S37's hold was correct — and left exactly one survivor, **EWMA-mean M (hl=6, 0.6745) with jointly refit B ≈ 1.75**, at −0.00075 with a CI *barely* excluding zero. They state it needs independent replication before shipping. It is not in this PR. Their ranked #1 (candle backfill at session close → resolve on the final-minute average) is also unbuilt and now carries three loads: the `B(14) = 0.90` settle-basis artifact, the settle basis itself, and the broken volume field.

**Did not fix two things I found.** Both were out of the question's scope and both interact with work already ranked:
- **`sigmaFromPts` is biased low early in a session.** It returns `sqrt(mean(u²))`; at k=2 there is exactly one squared difference so it collapses to `|u|`, whose expectation is `0.798σ`. σ_cur understated ~20% at k=2, ~11% at k=3, decaying after; the 0.6/0.4 blend puts ~8% of that on the dial at k=2. A pooled `B` cannot absorb a k-dependent bias. Interacts directly with round 3 §3 — should not be fixed in isolation.
- **`pruneShadow` is O(rows × sessions) per 20s persist** (round 3 §4.4). Not a correctness bug. `shadowSessions()` adds a full `srows` scan per read and per render — trivial at the 25k cap, on the same hot path if it rises.

**No Linear tickets.** Unchanged from S37: the artifact is off the THS board by prior judgment.

---

## Verification

```
tools/behaviour.mjs      165 PASS / 0 FAIL   (was 145 — 20 new)
tools/selftest.mjs        14 in-artifact + 3 layout + 10 grouped-log, 0 FAIL
tools/bundle.mjs verify   round-trip clean, both copies in sync
browser render            B tile 1.49 · shadow calibration panel populated · no console errors
```

Every new assertion was watched failing first. The red run is in the commit body: 5 S20 failures (`got=1.77 want=1.49`), 4 S22 failures (`got=n0 want=n40`), and S21 failing as "method does not exist".

`S20` resolves props exactly the way the runtime does, so a declared default drifting from the ruled constant now fails the suite instead of the operator's screen. That is the assertion whose absence let this ship.

**Method note:** the calibration numbers come from driving the artifact's own methods, not a reimplementation of them. That was deliberate — S37's defect 4 and the reviewer's round-2 error were both "measured on a basis the dial doesn't run", and a hand-written replica would have been a third instance of the same disease.

---

## Prod database state

**Unchanged.** No migrations, no writes, no schema work. `hp1.*` exactly as S36/S37 left it. Shadow mode writes to browser `localStorage` only.

---

## Pending Terry actions

| # | Action | Why |
|---|---|---|
| 1 | **Clear the shadow log and restart it** | Everything in it was scored by a dial running `M=1` at `B=1.77` — an engine that no longer exists. The tool now says so itself. |
| 2 | **Merge #37 then #38** (or either order — see the merge note in #38) | #37 is the clear-button fix; until it lands, clearing shadow needs `localStorage.removeItem('edge.shadow.v3')` |
| 3 | **Still do not size positions** | Unchanged from S37, and now better founded: the traded dial was 4pp overconfident at 80–90 for two sessions |
| 4 | Decide on the **EWMA-M package** | The only survivor of review round 3, needs independent replication first |
| 5 | Decide whether BTC Session Edge gets Linear tracking | Still off-board by prior judgment |

---

## Next in build order

**This session was off the THS build order entirely**, same as S37. AI Thesis proper is unchanged: verify the HP-1 live run once Terry sets `HP1_DB_URL` and runs the backfill, then the frontend fork into `terry-zero-in/hp1`.

For the BTC artifact, the ranked list is now: **candle backfill** (three loads), **Kalshi collector** (everything strategy-shaped is blocked on quote history), **scoring-unit change** (session-unit headline at first actionable read), **EWMA-M** (replicate first).

Shadow mode is worth restarting *now* — but the thing to check is no longer "is the dial calibrated". It is: **does live shadow calibration match the baked per-k skill curve**, which is the earliest regime-drift alarm available from data already collected.

---

## Skills loaded this session

`/honesty`, `/verification-before-completion`, `/systematic-debugging`. The full `CLAUDE.md` list was not loaded — this session opened directly into a specific BTC diagnostic question rather than the standard AI Thesis design posture, and the design skills (`/lambo`, `/ferrari`, `/frontend-design`, `/ui-ux-pro-max`, `/linear`) had no bearing on it. `/subagent-driven-development` and `/dispatching-parallel-agents` were deliberately not used: this session's instructions disallowed subagents. Flagging rather than backfilling a claim, per S37's precedent.

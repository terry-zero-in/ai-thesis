# S39 — BTC Session Edge: live operation against Kalshi, three more defects

**Date:** 2026-08-07 · **Branch:** `claude/btc-edge-v3-calibration-7wceyz` · **HEAD:** `1ed13d1` · **1 commit ahead of `origin/main`** · **PR [#39](https://github.com/terry-zero-in/ai-thesis/pull/39)** (open, draft, mergeable, CI 4/4 green)

Same calendar session as S38, continued after Terry put the tool into live operation next to the real Kalshi book. S38's record ends at PR #38 (merged). This covers everything after.

---

## HEADLINE — read this before trading anything

**Terry ran the tool beside the live Kalshi market for the first time. That produced one fixed defect, two unfixed ones, and a reframing of what the tool is for.**

| # | Defect | State | Effect |
|---|---|---|---|
| 8 | **A stale poll at a session boundary silently cost the whole session** | **fixed, PR #39** | Shadow sat at "waiting for the next session · 0 reads" across three consecutive sessions with a live feed |
| **9** | **The model's clock only ticks once a minute** | **OPEN — biggest correctness item on the board** | **Up to 16pp of probability error in the endgame, always toward the losing side of cheap contracts** |
| **10** | **Minute 0 cannot be priced at all** | **OPEN** | The one moment Kalshi's price is most anchored, and the tool returns nothing |

### Defect 9 is the one that matters

The model looks up remaining variance by **whole minute**. It knows it is in minute 14; it does not know whether that means 60 seconds left or 5. It returns the identical number for all 60 seconds while real time drains away.

Measured, same $10 gap and hour-0 baseline, comparing what the tool shows against an interpolated within-minute value:

| Minute | shown | 30s in | 50s in | error |
|---|---|---|---|---|
| 2 | 45.0% | 44.9% | 44.8% | 0.2pp |
| 5 | 44.2% | 44.0% | 43.9% | 0.3pp |
| 8 | 42.7% | 42.4% | 42.2% | 0.5pp |
| 10 | 41.1% | 40.4% | 39.9% | 1.2pp |
| 12 | 37.4% | 35.7% | 34.1% | 3.3pp |
| 13 | 33.1% | 28.9% | 23.4% | **9.8pp** |
| 14 | 18.3% | 10.7% | 2.5% | **15.8pp** |

Negligible before minute 10 — an earlier claim in-session that it was "slightly wrong everywhere else" was **wrong and is corrected here**. It is a cliff starting around minute 12, not a pervasive fog.

**The error always points the same way.** Overstating remaining time overstates uncertainty, which drags the probability toward 50/50, which makes the longshot look better than it is. Longshots are the cheap contracts. So the tool systematically recommends the losing side of cheap bets, in the window where they look most tempting.

**Caught live.** Terry's screenshot, 36 seconds to close, $2.41 below target: tool said **43% up**, Kalshi said **21%**. Backing out Kalshi's implied remaining move gives ~$2.71 against the tool's $9.94 — the tool was overstating by ~3.6×. Kalshi was right.

Kalshi settles on the **average of 60 prices in the final minute**, so at 36 seconds left roughly 24 of those prices are already banked. The tool has no way to represent that.

**Minutes 1–13 are a straightforward interpolation. Minute 14 is not** — the settlement average means part of the outcome is already locked, and the tool never observed those prices, it only sees the current one. That is a modelling decision, not arithmetic, and getting it wrong swaps one bias for another. **Deliberately not decided this session.**

**Operating rule until fixed: no new positions after minute 11.**

---

## Operating posture — Terry's directives this session

Terry pushed back hard on the tool's premise, and he was right. Recorded because it changes what the next session should build:

> *"If I want to know probability every minute then I just look at how Kalshi prices it obviously. I'm looking for that arbitrage based on historicals versus them weighting current."*

> *"I would want to know when it may be a true 50/50 bet based on historicals but Kalshi has it priced at 40 cents to buy the upside. But I don't see how this tells me that."*

**The product is the gap, not the probability.** A probability that agrees with the market is a redundant display. The tool computes the gap (`mkt ¢` + fee-adjusted ceiling on the TRADE tab) but buries it in a side panel, requires manual entry, and shadow mode does not log it at all — shadow currently answers "is my model honest?" when the question is "is the market wrong?"

He also asked repeatedly for plain-English explanation over jargon. Several replies this session were too abstract and had to be redone concretely; the useful register was step-by-step with worked numbers.

---

## What shipped — PR #39

**`1ed13d1` — Defect 8: a stale poll at a boundary silently cost the whole session.**

Root cause: the stale-feed guard `return`ed **before** the session-roll block, so a repeated trade timestamp straddling a boundary skipped the roll, the previous session's resolve, and strike adoption. Past the 75-second arming window the session is unarmed, and unarmed means it sits out all 15 minutes — then does it again, displaying a message that reads like normal operation.

Localised by Terry's own observation that toggling shadow off/on fixed it: toggling is the only path that calls `fetchShadow()` directly rather than through the 20-second interval.

Fixes in the commit:
- The guard now blocks **only the read**. A repeated trade timestamp means there is no new price to record; it says nothing about what time it is.
- **`armFromCandles()`** recovers a late join. The 1-minute candle endpoint is useless live (`max-age=300`) but authoritative for past minutes, so the true session open is retrievable after the fact. The point chain is seeded from minutes already closed; the current minute is excluded so it stays readable; **no reads are fabricated** for minutes missed.
- **`persistShadow()`** now persists the state it was handed rather than reading `this.state` immediately after `setState` — under React that is uncommitted, so it was writing a cursor one poll stale and would resume from it after a reload. Same harness-is-not-production family as defect 5; the Node harness applies `setState` synchronously and cannot see it, so `S28` asserts the parameter path directly.

Verified end-to-end in a real browser with a controlled clock, reproducing Terry's exact case — joining at **:06**, six minutes past the window:

| | before | after |
|---|---|---|
| strike | never adopted | **64400**, the true minute-0 open, one candle call |
| reads logged | **0, indefinitely** | **9** |

---

## Judgment calls

**Did not fix defect 9 this session.** Minutes 1–13 are easy; minute 14 needs a decision about how to treat the partially-locked settlement average. Shipping the easy half alone would leave the dangerous half intact while making the tool *look* fixed. Flagged for Terry rather than picked unilaterally at 1am.

**Did not fix defect 10 this session.** Small and contained, but it belongs with defect 9 — both are "the model's notion of remaining time is wrong," and fixing one without the other means two rounds of re-verification against the same fixtures.

**Restarted the branch from `main` after #38 squash-merged** rather than stacking. Otherwise the #39 diff would replay all of #38's already-merged work. Force-push discarded only merged history; the one unmerged commit was cherry-picked forward.

**Accepted a Codex review finding on #38** (`shadowSessions()` dropped flat `'F'` resolutions while the traded `mult()` accepts them). Reproduced it before fixing — four sessions with one flat gave `n=3` and left `M` pinned at 1. Corrected their stated rationale in the thread: a flat session is a genuine `|finalDelta| = 0` volatility observation, so excluding it biases `M` up on its own terms, not merely relative to the traded path. Left the contrary position (review round 3 §4.6, which wants `'F'` out of **both** paths) open rather than resolving it silently — that would be a model change on contested evidence.

**No Linear tickets.** Unchanged from S37/S38: BTC Session Edge is not on the THS board, and no THS ticket was touched this session. Whether it gets formal tracking remains a Terry decision (S38 pending item 5), now more pressing given two open defects.

---

## Verified facts — don't re-prove these

- **Kalshi runs two different BTC 15-min products and they are easy to confuse.** The middle row `Target Price: $X · Chance N%` is the target-price binary — that is what this tool prices when you type Kalshi's target in. The right-hand panel titled **"BTC Up or Down - 15 minutes"** (`UP 55¢ / DOWN 46¢`) is a *different bet*, priced off the session open. Comparing the tool to the Up/Down panel will mislead every time. Confirmed from Terry's screenshots where the same instant showed `Chance 21%` and `UP 55¢`.
- **Shadow mode's synthetic strike prices the Up/Down question, not the target question.** Its strike is the Coinbase session open, ~$5–20 from Kalshi's CF Benchmarks target (measured this session: **$10.73**). Fine for grading the model, wrong reference for a trade.
- **The model is structurally the same as any short-dated binary pricer** — distance ÷ volatility × √time. Expect agreement with Kalshi, not divergence. Measured at minute 3: tool `DOWN 60%` vs Kalshi `39% above` → 61% down. **One point apart.**
- **Kalshi's spread on these is ~1¢** (55 + 46 = 101). Clearing fees plus spread needs roughly 4¢ of edge. A market quoting that tight and agreeing to within a point is not obviously leaving 4¢ on the table. Any edge will be rare and situational.
- **`REMVAR` has 14 entries covering k=1..14. There is no k=0 entry**, which is why `read()` returns `session just opened — a read needs one full minute`. The missing value is computable from data already in the file: **sum of all `SHAPE²` = 15.132842** (matches `SUM_SHAPE2` to 6dp).
- **Coinbase candles endpoint is viable for backfill.** `?granularity=60&start=<ts>&end=<ts+900>`, rows are `[time, low, high, open, close, volume]`, `access-control-allow-origin: *`, `cache-control: max-age=300`. Verified against a live past block.
- **Coinbase ticker `time` advances on every poll** at 20s cadence — measured six consecutive polls. The stale guard firing in production was not a dead feed.
- Everything in S37's verified-facts block still holds (Kalshi API closed to browsers, settlement is BRTI averaged over the final minute, Vercel project/team IDs).

---

## Prod database state

**Unchanged.** No migrations, no writes, no schema work. `hp1.*` exactly as S36 left it. Shadow mode writes to browser `localStorage` only.

---

## Commits pushed

```
1ed13d1 Defect 8: a stale poll at a boundary silently cost the whole session
```

Merged to `main` earlier in this calendar session: `8db1b40` (#38, the fifth defect), `e8bdff1` (#37, clear the log you are looking at).

---

## Verification

```
tools/behaviour.mjs      190 PASS / 0 FAIL   (16 new this commit, each watched red first)
tools/selftest.mjs        14 in-artifact + 3 layout + 10 grouped-log, 0 FAIL
tools/bundle.mjs verify   round-trip clean, both copies in sync
PR #39 CI                 4/4 green
browser, fake clock       late join at :06 recovers and logs 9 reads
```

No TSC/lint/dev-server status — the artifact is a standalone HTML file outside the Next.js app with no build step. `web/` untouched apart from the served copy in `public/`.

---

## Pending Terry actions

| # | Action | Why |
|---|---|---|
| 1 | **Merge PR #39** | Without it, a backgrounded tab silently collects nothing overnight |
| 2 | **Decide the minute-14 settlement treatment** (defect 9) | Blocks the fix. The question: how to model a settlement average that is partly already locked when the tool never observed the locked prices |
| 3 | **No new positions after minute 11** until defect 9 ships | The tool is a losing-bet generator in the endgame |
| 4 | **Don't read anything into current model-vs-Kalshi gaps** | `M` is inert (needs 4 resolved sessions), so the dial has no live volatility adjustment while Kalshi's makers do |
| 5 | Decide whether BTC Session Edge gets Linear tracking | Two open defects now live only in markdown |
| 6 | Decide whether the EWMA-M package ships | Round 3's only survivor, needs independent replication first |

---

## Next in build order

**Still off the THS build order entirely.** AI Thesis proper has not moved since S36: verify the HP-1 live run once `HP1_DB_URL` is set and the backfill runs, then the frontend fork into `terry-zero-in/hp1`.

For the BTC artifact, the ranking has changed. **Defect 9 is now #1**, ahead of everything on the external review's list — it is worth 10–16 percentage points in the endgame, where that list argued over thousandths of a Brier score.

1. **Defect 9 — sub-minute time.** Interpolate `REMVAR` within the minute for k=1..13; decide the minute-14 treatment deliberately.
2. **Defect 10 — price minute 0.** `REMVAR[0] = 15.132842`. Contained, do it with #1.
3. **Put the gap on screen and log it.** `MODEL 47% · MARKET 42¢ · EDGE +5¢`, recorded every minute. This is what Terry actually asked for and the only thing that makes the tool non-redundant.
4. **Candle backfill at session close** — resolve on the final-minute average, real per-minute volume, `B(14)` artifact. Half of it now exists as `armFromCandles()`.
5. **Kalshi collector → Supabase.** Everything price-shaped is blocked on quote history.

---

## Skills loaded this session

`/honesty`, `/verification-before-completion`, `/systematic-debugging`, `/sch` at close. The full `CLAUDE.md` list was not loaded — this session was a specific BTC diagnostic rather than the AI Thesis design posture, and the design skills had no bearing. `/subagent-driven-development` and `/dispatching-parallel-agents` were deliberately not used: this session's instructions disallowed subagents. Flagged rather than backfilled, per S37/S38 precedent.

---

## Recommendation for next session

**Fix defect 9 before anything else, and get Terry's answer on minute 14 first.** Everything else — the collector, EWMA-M, the scoring-unit change — is optimisation on a dial that is materially wrong in the last three minutes. Shipping any of it first would be polishing around a hole.

**Then build the gap log, not more model.** The strongest evidence from this session is that the model and Kalshi *agree*, to within a point, at a 1¢ spread. That is not a failure — it means the model is sane — but it does mean the interesting question has moved from "is the probability right" to "when, if ever, is the market wrong." Nothing currently instruments that. Terry can spot-check manually in the meantime (type their target and price during minutes 3–9, watch whether `+EV` ever appears), and if it never does over a few dozen sessions, that is a real answer that cost nothing to obtain.

**Do not add model factors.** Round 3 withdrew three of its four round-2 recommendations as basis artifacts. The one survivor needs independent replication. The board has two live correctness defects; that is where the effort belongs.

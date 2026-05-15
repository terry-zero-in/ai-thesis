---
name: compact-assessment
description: Manual-fire skill. When invoked, estimate current context usage based on session length / files read / tool calls and recommend /compact or proceed. NO autofire — Claude cannot reliably measure context %. Better path when invoked: attempt the /ctx skill first for a real measurement; fall back to estimate only if /ctx is unavailable.
---

# Compact Assessment

Manual-invocation skill. Fires only when Terry runs it explicitly. The autofire-on-threshold pattern was removed 2026-05-13 because Claude cannot reliably measure its own context % — the founding-case miss estimated 30-35% when actual was 12%, off by 20+ points. Guessing wastes Terry's attention; the only honest postures are *measure* or *don't recommend*.

## When invoked, do this — in order

### 1. Try to measure (better path first)

Invoke the `/ctx` skill if available — it runs the OpenClaw context monitor and returns a real number. If `/ctx` returns a measurement, skip to step 3 with that number.

If `/ctx` is unavailable, fails, or you don't have permission to run it: **say so explicitly** ("`/ctx` unavailable — falling back to estimate") and continue to step 2. Never silently estimate when measurement was an option.

### 2. Estimate (only if measurement failed)

Estimate current context usage based on observable signals: total session length, large file reads, big tool outputs, subagent spawns, image/PDF loads. State the estimate as a range, not a point: "estimate ~25-40% based on N file reads + M tool calls."

Mark the recommendation **(estimated)** anywhere it lands.

### 3. Recommend

Apply the table to the measurement (or estimate).

| Context | Recommendation |
|---|---|
| < 30% | **PROCEED** — no compact needed. |
| 30-50% | **NOTE** — "compact-eligible at next clean task boundary." No action this turn. |
| 50-70% | **RECOMMEND** — "`/compact` at next clean boundary. Want me to write a state snapshot first?" |
| > 70% | **STRONGLY RECOMMEND** — "compact now; risk of auto-compact mid-task is high." |

## When recommending compact

Surface in one line:

> "Context ~X% (measured | estimated). Recommend `/compact` at next clean boundary. Want me to write a state snapshot first?"

If Terry says yes (or standing autonomy applies for low-impact projects):
1. **Write a state preservation file** to the active project's `docs/<area>/handoffs/<date>-<session>-mid-compact-<N>.md`.
2. **Include:** current task in progress, completed work this session (linked artifacts), pending Terry-asks, next planned action with file paths/line numbers, live infrastructure state (ports, branches, processes), open subagents.
3. **Confirm written** and tell Terry to `/compact`.

If Terry declines: proceed without compacting; do not re-prompt this turn.

## Why this exists

Compacting mid-task loses fine-grained working memory. Compacting between tasks loses nothing if state was preserved on disk. Terry historically compacts at 25-30% because earlier = cleaner output. This skill exists to support that habit when Terry asks, not to autofire on a number Claude can't see.

## Rule status

**Manual-fire only.** No silent precondition checks at task boundaries. No "I think we're at X%" volunteering. Fires only when Terry types `/compact-assessment` or asks for an assessment.

## Anti-patterns

- ❌ **Autofiring at task boundaries** — that's the old pattern; removed.
- ❌ **Estimating without first attempting `/ctx`** — measurement is the better path; estimate is the fallback.
- ❌ **Stating an estimate as a point number** ("we're at 38%") — estimates are ranges, marked `(estimated)`.
- ❌ **Recommending compact on an unmarked estimate.** If you couldn't measure, the user must know it's a guess.
- ❌ **Re-prompting the same turn** after Terry declines.
- ❌ **Padding the recommendation with extra explanation.** One line, then act.

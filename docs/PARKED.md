# Parked Items

Items deliberately deferred for v1 with the rationale and the conditions under which to revisit. Update this doc when an item is either acted on or re-confirmed as parked.

Companion to `docs/HANDOFF.md` (Terry's cross-session state) — that doc lists parked items at the summary level; this one carries the code-grounded detail.

## 1. 10b5-1 parser for insider clusters

**Status:** Deferred for v1. Accepted as known limitation.

**What's missing:** `factor-insider.ts` filters out 10b5-1 (pre-scheduled) sales via the `is_10b5_1` flag on each transaction, but the ingestor doesn't currently parse the SEC Form-4 footnote links that disclose 10b5-1 plans. In practice the flag is often `null` (undetermined), so some 10b5-1 sales leak through the SELL cluster override.

**Why it's parked:** The cluster threshold (3+ insiders, ≥$5M each, in 60 days) already filters most routine 10b5-1 noise. Building the SEC footnote parser is ~half a session of work for marginal precision improvement on a signal that's already filtered three other ways.

**Revisit when:** Epic 6 is running in production and we have ≥3 months of cluster-override events to measure against. If false-positive rate (10b5-1 mistaken for discretionary) proves material — say, >20% of SELL clusters turn out to be 10b5-1 — build the parser.

**Owner:** any session post-Epic-6 launch.

## 2. Forward capex consensus (THS-67 check #4)

**Status:** Deferred. Using trailing-12mo capex as a documented proxy.

**What's missing:** The spec calls for THS-67 quarterly check #4 ("consensus 2026/2027 capex movement > 10%") to fire on **forward** consensus capex estimates. The `consensus` table currently only carries EPS + rating, not capex_fy1 / capex_fy2.

**What's in place:** `quarterly-checklist.ts::checkConsensusCapex` reports trailing-12mo capex YoY deltas instead, tagged as `data_gap` severity so the operator knows the spec check isn't the one firing.

**Why it's parked:** Extending FMP ingestion + schema for forward capex is a non-trivial change touching the consensus pipeline and several factor readers. The TTM proxy surfaces the same hyperscaler capex acceleration / deceleration regime, just with a lag.

**Revisit when:** A quarterly review surfaces a case where the TTM proxy missed a capex inflection that forward consensus would have caught, OR quarterly review accuracy is otherwise demonstrably impaired.

**Owner:** any session that finds the TTM proxy insufficient.

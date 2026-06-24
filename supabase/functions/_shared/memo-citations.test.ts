import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMemoCitations } from "./memo-citations.ts";
import type { MemoContext } from "./memo-context.ts";

// A fixed context: 3 movers, 2 insiders, macro = 1 gate hit / 0.95 multiplier.
const ctx: MemoContext = {
  as_of: "2026-06-24",
  movers: [
    { ticker: "NVDA", prior_score: 70.0, current_score: 75.7, delta: 5.7, tier_prior: "Medium", tier_current: "High" },
    { ticker: "TSM", prior_score: 80.0, current_score: 82.2, delta: 2.2, tier_prior: "High", tier_current: "High" },
    { ticker: "PLTR", prior_score: 60.0, current_score: 64.4, delta: 4.4, tier_prior: "Low", tier_current: "Medium" },
  ],
  insiders: [
    { ticker: "AVGO", insider_name: "Hock Tan", insider_title: "CEO", transaction_date: "2026-06-23", direction: "BUY", value: 1_500_000, is_10b5_1: false },
    { ticker: "GOOGL", insider_name: "Ruth Porat", insider_title: "CFO", transaction_date: "2026-06-23", direction: "SELL", value: 2_300_000, is_10b5_1: true },
  ],
  macro: { as_of: "2026-06-24", naaim: 92.0, aaii_3wk_spread: 31.0, fear_greed: 80.0, gates_hit: 1, multiplier: 0.95 },
  data_gaps: ["News digest top-30: no news feed ingested yet."],
  universe_size: 70,
};

// Held-out / universe names NOT in today's context — mentioning one is a leak.
const UNIVERSE = ["NVDA", "TSM", "PLTR", "AVGO", "GOOGL", "AMD", "MDB", "NET", "CRM", "ADBE", "ZS", "INTC", "IBM"];

const opts = { universe: UNIVERSE };

test("clean memo — every ticker + number traces to context → 0 leaks", () => {
  const memo = `## Headline
NVDA leads with a +5.7 move into High.

## Top Movers
- NVDA +5.7 (Medium → High). Unexplained on signal alone.
- PLTR +4.4 into Medium.
- TSM +2.2, holds High.

## Insider Activity
- BUY AVGO $1.5M — Hock Tan (CEO). Not 10b5-1.
- SELL GOOGL $2.3M — Ruth Porat (CFO), 10b5-1.

## Macro
Gates-hit 1, multiplier 0.95. NAAIM hot.

## What to watch
NVDA into the print.`;
  const r = validateMemoCitations(memo, ctx, opts);
  assert.equal(r.unhandled, 0);
  assert.equal(r.leaks.length, 0, JSON.stringify(r.leaks));
  assert.equal(r.leak_rate, 0);
  assert.ok(r.ticker_claims >= 5);
  assert.ok(r.number_claims >= 4);
});

test("hallucinated universe ticker absent from context → 1 ticker leak", () => {
  const memo = `## Top Movers\n- AMD +5.7 ripped higher.`;
  const r = validateMemoCitations(memo, ctx, opts);
  const tickerLeaks = r.leaks.filter((l) => l.kind === "ticker");
  assert.equal(tickerLeaks.length, 1);
  assert.equal(tickerLeaks[0].text, "AMD");
});

test("wrong delta → 1 delta leak (the rest validate)", () => {
  const memo = `## Top Movers\n- NVDA +9.9 (Medium → High).`;
  const r = validateMemoCitations(memo, ctx, opts);
  const dl = r.leaks.filter((l) => l.kind === "delta");
  assert.equal(dl.length, 1);
  assert.equal(dl[0].text.replace(/\s/g, ""), "+9.9");
});

test("fabricated dollar value → 1 value leak", () => {
  const memo = `## Insider Activity\n- BUY AVGO $9.9M — Hock Tan.`;
  const r = validateMemoCitations(memo, ctx, opts);
  const vl = r.leaks.filter((l) => l.kind === "value");
  assert.equal(vl.length, 1);
});

test("numeric tolerance — delta within ±0.1 validates", () => {
  const memo = `## Top Movers\n- NVDA +5.8 into High.`; // ctx delta 5.7, |Δ|=0.1
  const r = validateMemoCitations(memo, ctx, opts);
  assert.equal(r.leaks.filter((l) => l.kind === "delta").length, 0);
});

test("acronyms / section words / layers are NOT ticker claims", () => {
  const memo = `## Macro\nThe AI sleeve across L1 and L4. BUY vs SELL. CEO and CFO. Q1 print. Gates-hit 1.`;
  const r = validateMemoCitations(memo, ctx, opts);
  assert.equal(r.ticker_claims, 0, JSON.stringify(r.leaks));
});

test("ISO date is not misread as a delta or score", () => {
  const memo = `## Headline\nMorning brief for 2026-06-24. NVDA +5.7.`;
  const r = validateMemoCitations(memo, ctx, opts);
  // only the +5.7 delta is a number claim; the date contributes none.
  assert.equal(r.leaks.length, 0, JSON.stringify(r.leaks));
});

test("robust — empty / non-string input never throws, 0 claims", () => {
  const empty = validateMemoCitations("", ctx, opts);
  assert.equal(empty.total_claims, 0);
  assert.equal(empty.leak_rate, 0);
  // @ts-expect-error deliberately pass a non-string to prove no throw
  const nullish = validateMemoCitations(null, ctx, opts);
  assert.equal(nullish.unhandled, 0);
  assert.equal(nullish.total_claims, 0);
});

test("leak_rate is leaks/total and unhandled stays 0 on a mixed memo", () => {
  const memo = `## Top Movers
- NVDA +5.7 into High.
- AMD +1.0 (not in context).

## Insider Activity
- BUY AVGO $9.9M.`;
  const r = validateMemoCitations(memo, ctx, opts);
  assert.equal(r.unhandled, 0);
  assert.ok(r.leaks.length >= 2); // AMD ticker + AMD's +1.0 delta + bad $ value
  assert.ok(r.leak_rate > 0 && r.leak_rate <= 1);
});

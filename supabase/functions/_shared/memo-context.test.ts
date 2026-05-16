import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  INSIDER_VALUE_MIN,
  MOVERS_TOP_N,
  buildMemoContext,
  renderContextPayload,
  type BuildContextInputs,
  type InsiderTx,
  type ScoreSnapshot,
} from "./memo-context.ts";

function score(t: string, fs: number | null, tier: string | null = null): ScoreSnapshot {
  return { ticker: t, as_of: "2026-05-16", composite: fs, final_score: fs, tier };
}

function tx(o: Partial<InsiderTx>): InsiderTx {
  return {
    ticker: "NVDA",
    transaction_date: "2026-05-15",
    insider_name: "Jane Doe",
    insider_title: "CFO",
    transaction_code: "P",
    shares: 1000,
    price_per_share: 1100,
    transaction_value: 1_100_000,
    is_10b5_1: false,
    ...o,
  };
}

function base(overrides: Partial<BuildContextInputs> = {}): BuildContextInputs {
  return {
    as_of: "2026-05-16",
    currentScores: [],
    priorScores: [],
    insiderFilings: [],
    macro: { as_of: "2026-05-14", naaim: 96, aaii_3wk_spread: 5, fear_greed: 66, gates_hit: 1, multiplier: 0.95 },
    ...overrides,
  };
}

describe("buildMemoContext", () => {
  it("ranks movers by |delta|, top 5", () => {
    const current = [
      score("AAA", 80), score("BBB", 70), score("CCC", 60),
      score("DDD", 50), score("EEE", 40), score("FFF", 30),
    ];
    const prior = [
      score("AAA", 70), // +10
      score("BBB", 71), // -1
      score("CCC", 50), // +10
      score("DDD", 60), // -10
      score("EEE", 45), // -5
      score("FFF", 50), // -20  (biggest |delta|)
    ];
    const ctx = buildMemoContext(base({ currentScores: current, priorScores: prior }));
    assert.equal(ctx.movers.length, MOVERS_TOP_N);
    assert.equal(ctx.movers[0].ticker, "FFF"); // |-20| wins
    assert.equal(Math.abs(ctx.movers[0].delta), 20);
    // The five returned should be the five largest |delta|.
    const deltas = ctx.movers.map((m) => Math.abs(m.delta));
    for (let i = 1; i < deltas.length; i++) {
      assert.ok(deltas[i - 1] >= deltas[i], "deltas must be non-increasing");
    }
  });

  it("skips tickers missing prior or current scores", () => {
    const current = [score("AAA", 80), score("BBB", null)];
    const prior = [score("AAA", 70)]; // BBB has no prior
    const ctx = buildMemoContext(base({ currentScores: current, priorScores: prior }));
    assert.equal(ctx.movers.length, 1);
    assert.equal(ctx.movers[0].ticker, "AAA");
  });

  it("filters insider events to ≥ $1M, BUY/SELL only", () => {
    const fs: InsiderTx[] = [
      tx({ ticker: "NVDA", transaction_code: "P", transaction_value: 5_000_000 }),
      tx({ ticker: "AVGO", transaction_code: "S", transaction_value: 2_000_000 }),
      tx({ ticker: "META", transaction_code: "P", transaction_value: 500_000 }), // below threshold
      tx({ ticker: "MSFT", transaction_code: "M", transaction_value: 10_000_000 }), // exercise — excluded
      tx({ ticker: "GOOGL", transaction_code: "F", transaction_value: 10_000_000 }), // tax — excluded
    ];
    const ctx = buildMemoContext(base({ insiderFilings: fs }));
    assert.equal(ctx.insiders.length, 2);
    assert.equal(ctx.insiders[0].ticker, "NVDA"); // sorted by value desc
    assert.equal(ctx.insiders[1].ticker, "AVGO");
    assert.equal(INSIDER_VALUE_MIN, 1_000_000);
  });

  it("derives transaction value from shares * price when transaction_value null", () => {
    const fs = [tx({ transaction_value: null, shares: 1500, price_per_share: 1000 })]; // 1.5M
    const ctx = buildMemoContext(base({ insiderFilings: fs }));
    assert.equal(ctx.insiders.length, 1);
    assert.equal(ctx.insiders[0].value, 1_500_000);
  });

  it("flags news / sector_news as data gaps when not provided", () => {
    const ctx = buildMemoContext(base());
    assert.ok(ctx.data_gaps.some((g) => /news feed/i.test(g)));
    assert.ok(ctx.data_gaps.some((g) => /sector news/i.test(g)));
  });

  it("omits data gaps when feeds are available", () => {
    const ctx = buildMemoContext(base({ hasNewsFeed: true, hasSectorNews: true }));
    assert.deepEqual(ctx.data_gaps, []);
  });

  it("preserves macro state and universe size verbatim", () => {
    const current = [score("AAA", 80), score("BBB", 70), score("CCC", 60)];
    const ctx = buildMemoContext(base({ currentScores: current }));
    assert.equal(ctx.universe_size, 3);
    assert.equal(ctx.macro.gates_hit, 1);
    assert.equal(ctx.macro.multiplier, 0.95);
  });

  it("renderContextPayload produces deterministic JSON", () => {
    const ctx = buildMemoContext(base({
      currentScores: [score("AAA", 80)],
      priorScores: [score("AAA", 70)],
    }));
    const a = renderContextPayload(ctx);
    const b = renderContextPayload(ctx);
    assert.equal(a, b);
    assert.match(a, /"top_movers"/);
    assert.match(a, /"AAA"/);
    assert.match(a, /"delta": 10/);
  });

  it("renderContextPayload rounds scores to 1 decimal", () => {
    const ctx = buildMemoContext(base({
      currentScores: [score("AAA", 80.166666)],
      priorScores: [score("AAA", 70.4444)],
    }));
    const json = renderContextPayload(ctx);
    assert.match(json, /"current_score": 80\.2/);
    assert.match(json, /"prior_score": 70\.4/);
    assert.match(json, /"delta": 9\.7/);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONCENTRATION_TAX_FLAG,
  SCORE_DROP_THRESHOLD,
  buildWeeklyContext,
  renderWeeklyContextPayload,
  type WeeklyRankingInputs,
  type WeeklyScoreSnapshot,
} from "./weekly-ranking.ts";

function snap(
  t: string,
  finalScore: number | null,
  tier: string | null = null,
  layer = 1,
): WeeklyScoreSnapshot {
  return {
    ticker: t,
    layer,
    layer_label: `L${layer}`,
    composite: finalScore,
    final_score: finalScore,
    tier,
  };
}

function base(o: Partial<WeeklyRankingInputs> = {}): WeeklyRankingInputs {
  return {
    as_of: "2026-05-17",
    current: [],
    prior: [],
    insiders: [],
    depFlags: [],
    concentration: [],
    ...o,
  };
}

describe("buildWeeklyContext", () => {
  it("ranking sorted by final_score desc, nulls last", () => {
    const current = [
      snap("AAA", 70),
      snap("BBB", 80),
      snap("CCC", null),
      snap("DDD", 60),
    ];
    const ctx = buildWeeklyContext(base({ current }));
    assert.deepEqual(
      ctx.ranking.map((r) => r.ticker),
      ["BBB", "AAA", "DDD", "CCC"],
    );
  });

  it("tier_counts tallies all four tiers + nulls", () => {
    const current = [
      snap("A", 80, "High"),
      snap("B", 65, "Medium"),
      snap("C", 50, "Low"),
      snap("D", 30, "Avoid"),
      snap("E", null, null),
    ];
    const ctx = buildWeeklyContext(base({ current }));
    assert.deepEqual(ctx.tier_counts, { High: 1, Medium: 1, Low: 1, Avoid: 1, null: 1 });
  });

  it("delta_w computed when both current + prior present", () => {
    const ctx = buildWeeklyContext(base({
      current: [snap("X", 80)],
      prior: [snap("X", 70)],
    }));
    assert.equal(ctx.ranking[0].delta_w, 10);
  });

  it("delta_w null when no prior snapshot exists", () => {
    const ctx = buildWeeklyContext(base({
      current: [snap("X", 80)],
    }));
    assert.equal(ctx.ranking[0].delta_w, null);
  });

  it("high_book only contains tier=High names", () => {
    const current = [snap("A", 80, "High"), snap("B", 60, "Medium")];
    const ctx = buildWeeklyContext(base({ current }));
    assert.equal(ctx.high_book.length, 1);
    assert.equal(ctx.high_book[0].ticker, "A");
  });

  it("emits sell_cluster bear case when insider SELL clusters present", () => {
    const ctx = buildWeeklyContext(base({
      current: [snap("X", 80, "High")],
      insiders: [{ ticker: "X", buy_30d: 0, sell_30d: 2 }],
    }));
    const flags = ctx.high_book[0].bear_cases;
    assert.equal(flags.length, 1);
    assert.equal(flags[0].kind, "sell_cluster");
  });

  it("emits dep_flag bear case when depreciation flag exists", () => {
    const ctx = buildWeeklyContext(base({
      current: [snap("META", 80, "High")],
      depFlags: [{ ticker: "META", flagged_at: "2026-04-15", penalty_v: -7, extension_years: 1.5 }],
    }));
    const flags = ctx.high_book[0].bear_cases;
    assert.ok(flags.some((f) => f.kind === "dep_flag"));
  });

  it("emits concentration_tax bear case when tax ≤ threshold", () => {
    const ctx = buildWeeklyContext(base({
      current: [snap("NVDA", 80, "High")],
      concentration: [{ ticker: "NVDA", tax: -5, mean_corr: 0.72 }],
    }));
    const flags = ctx.high_book[0].bear_cases;
    assert.ok(flags.some((f) => f.kind === "concentration_tax"));
    assert.equal(CONCENTRATION_TAX_FLAG, -3);
  });

  it("does not emit concentration_tax when tax is mild", () => {
    const ctx = buildWeeklyContext(base({
      current: [snap("AVGO", 80, "High")],
      concentration: [{ ticker: "AVGO", tax: -1, mean_corr: 0.5 }],
    }));
    const flags = ctx.high_book[0].bear_cases;
    assert.ok(!flags.some((f) => f.kind === "concentration_tax"));
  });

  it("emits score_drop bear case when |Δ| ≥ threshold", () => {
    const ctx = buildWeeklyContext(base({
      current: [snap("PLTR", 75, "High")],
      prior: [snap("PLTR", 82)], // Δ = -7
    }));
    const flags = ctx.high_book[0].bear_cases;
    assert.ok(flags.some((f) => f.kind === "score_drop"));
    assert.equal(SCORE_DROP_THRESHOLD, 5);
  });

  it("high_mean_corr averages mean_corr across the High roster", () => {
    const ctx = buildWeeklyContext(base({
      current: [snap("A", 80, "High"), snap("B", 78, "High")],
      concentration: [
        { ticker: "A", tax: 0, mean_corr: 0.6 },
        { ticker: "B", tax: 0, mean_corr: 0.8 },
      ],
    }));
    assert.equal(ctx.high_mean_corr, 0.7);
  });

  it("renderWeeklyContextPayload produces deterministic JSON", () => {
    const ctx = buildWeeklyContext(base({
      current: [snap("AAA", 80.123, "High")],
      concentration: [{ ticker: "AAA", tax: -5.7, mean_corr: 0.65 }],
    }));
    const a = renderWeeklyContextPayload(ctx);
    const b = renderWeeklyContextPayload(ctx);
    assert.equal(a, b);
    // Rounding: 1 dp for scores, 2 dp for correlation.
    assert.match(a, /"final_score": 80\.1/);
    assert.match(a, /"high_mean_corr": 0\.65/);
    assert.match(a, /"concentration_tax": -5\.7/);
  });

  it("includes a note when no prior snapshot is provided", () => {
    const ctx = buildWeeklyContext(base({
      current: [snap("X", 80, "High")],
    }));
    assert.ok(ctx.notes.some((n) => /No prior-week snapshot/.test(n)));
  });
});

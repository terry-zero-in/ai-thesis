import { test } from "node:test";
import assert from "node:assert/strict";
import {
  _internals,
  computeQForCohort,
  type QInputs,
  type Layer,
} from "./factor-q.ts";
import type { Fundamentals } from "./metrics.ts";

const baseFunds: Fundamentals = {
  revenue: null,
  gross_profit: null,
  operating_income: null,
  net_income: null,
  fcf: null,
  total_assets: null,
  total_debt: null,
  shareholders_equity: null,
  shares_diluted: null,
  cash_and_equivalents: null,
  retained_earnings: null,
  current_assets: null,
  current_liabilities: null,
  income_before_tax: null,
  income_tax_expense: null,
  dividends_paid: null,
  common_stock_repurchased: null,
};
const f = (over: Partial<Fundamentals>): Fundamentals => ({ ...baseFunds, ...over });

// Helper: emit aligned own/benchmark return series of given length around a
// target beta. Long enough (≥20) to clear the beta() minimum.
function syntheticReturns(targetBeta: number, n = 40): { own: number[]; benchmark: number[] } {
  const bench: number[] = [];
  const own: number[] = [];
  for (let i = 0; i < n; i++) {
    const b = Math.sin(i / 4) * 0.02;
    bench.push(b);
    own.push(targetBeta * b + 0.0001 * Math.cos(i / 3));
  }
  return { own, benchmark: bench };
}

// Helper: build a QInputs with a "current" row and 5 annual rows derived
// from scaling factors so 5y deltas are non-null and meaningful.
function makeInputs(
  ticker: string,
  layer: Layer,
  opts: {
    current: Partial<Fundamentals>;
    marketCap: number | null;
    beta?: number;
    epsSeries?: Array<{ net_income: number | null; shares_diluted: number | null }>;
    annuals?: Array<Partial<Fundamentals>>;
  },
): QInputs {
  const current = f(opts.current);
  // Build 5 annuals if not provided: same shape as current but reverse-scaled
  // so the 5y delta lands at zero (signals "no growth" by default).
  const annuals = (opts.annuals ?? Array(5).fill(opts.current)).map((a) => f(a));
  const epsHistory = opts.epsSeries ?? Array(20).fill({
    net_income: current.net_income,
    shares_diluted: current.shares_diluted,
  });
  return {
    ticker,
    layer,
    current,
    annuals,
    quarterlyHistory: epsHistory,
    returns: syntheticReturns(opts.beta ?? 1.0),
    marketCap: opts.marketCap,
  };
}

// ─── Pillar weight rule ─────────────────────────────────────────────────────

test("pillarWeights: L1-L3 halve payout, redistribute to other three", () => {
  for (const layer of [1, 2, 3] as Layer[]) {
    const w = _internals.pillarWeights(layer);
    assert.equal(w.payout, 0.125);
    assert.ok(Math.abs(w.profitability - 0.875 / 3) < 1e-12);
    assert.ok(Math.abs(w.profitability + w.growth + w.safety + w.payout - 1) < 1e-12);
  }
});

test("pillarWeights: L4-L5 use equal-weight QMJ (0.25 each)", () => {
  for (const layer of [4, 5] as Layer[]) {
    const w = _internals.pillarWeights(layer);
    assert.equal(w.payout, 0.25);
    assert.ok(Math.abs(w.profitability - 0.25) < 1e-12);
  }
});

// ─── Cohort assembly: layer-mixing rejected ─────────────────────────────────

test("computeQForCohort: rejects mixed layers", () => {
  const a = makeInputs("A", 1, { current: { gross_profit: 100, total_assets: 1000 }, marketCap: 1000 });
  const b = makeInputs("B", 2, { current: { gross_profit: 100, total_assets: 1000 }, marketCap: 1000 });
  assert.throws(() => computeQForCohort([a, b]), /layer/);
});

test("computeQForCohort: empty input → empty output", () => {
  assert.deepEqual(computeQForCohort([]), []);
});

// ─── End-to-end: scores within 0..100, ranking respects pillar quality ──────

test("computeQForCohort: clearly superior ticker scores highest", () => {
  // Three-name L4 cohort. "STRONG" is best on every profitability metric and
  // has lower beta and leverage. "AVG" is median. "WEAK" is worst across the
  // board. Expectation: STRONG has the highest qScore; WEAK the lowest.
  const strong = makeInputs("STRONG", 4, {
    current: {
      revenue: 1000,
      gross_profit: 700,
      operating_income: 300,
      net_income: 240,
      fcf: 280,
      total_assets: 2000,
      total_debt: 100,
      shareholders_equity: 1500,
      cash_and_equivalents: 500,
      retained_earnings: 1200,
      current_assets: 900,
      current_liabilities: 200,
      income_before_tax: 300,
      income_tax_expense: 60,
      shares_diluted: 100,
      dividends_paid: 30,
      common_stock_repurchased: 70,
    },
    marketCap: 10000,
    beta: 0.7,
  });
  const avg = makeInputs("AVG", 4, {
    current: {
      revenue: 1000,
      gross_profit: 500,
      operating_income: 180,
      net_income: 140,
      fcf: 160,
      total_assets: 2500,
      total_debt: 600,
      shareholders_equity: 1100,
      cash_and_equivalents: 200,
      retained_earnings: 700,
      current_assets: 700,
      current_liabilities: 400,
      income_before_tax: 175,
      income_tax_expense: 35,
      shares_diluted: 100,
      dividends_paid: 15,
      common_stock_repurchased: 25,
    },
    marketCap: 6000,
    beta: 1.0,
  });
  const weak = makeInputs("WEAK", 4, {
    current: {
      revenue: 1000,
      gross_profit: 300,
      operating_income: 70,
      net_income: 40,
      fcf: 50,
      total_assets: 3500,
      total_debt: 1500,
      shareholders_equity: 600,
      cash_and_equivalents: 50,
      retained_earnings: 200,
      current_assets: 400,
      current_liabilities: 600,
      income_before_tax: 50,
      income_tax_expense: 10,
      shares_diluted: 100,
      dividends_paid: 5,
      common_stock_repurchased: 10,
    },
    marketCap: 2000,
    beta: 1.4,
  });

  const results = computeQForCohort([strong, avg, weak]);
  const byTicker = Object.fromEntries(results.map((r) => [r.ticker, r]));

  for (const r of results) {
    assert.ok(r.qScore !== null && r.qScore >= 0 && r.qScore <= 100, `${r.ticker} qScore in 0..100`);
    assert.ok(r.compositeZ !== null && Number.isFinite(r.compositeZ), `${r.ticker} compositeZ finite`);
  }
  assert.ok(
    byTicker["STRONG"].qScore! > byTicker["AVG"].qScore!,
    `STRONG (${byTicker["STRONG"].qScore}) should outscore AVG (${byTicker["AVG"].qScore})`,
  );
  assert.ok(
    byTicker["AVG"].qScore! > byTicker["WEAK"].qScore!,
    `AVG (${byTicker["AVG"].qScore}) should outscore WEAK (${byTicker["WEAK"].qScore})`,
  );
});

test("computeQForCohort: identical tickers all score 50 (midpoint of tie)", () => {
  const tmpl = {
    current: {
      revenue: 1000,
      gross_profit: 500,
      operating_income: 200,
      net_income: 160,
      fcf: 180,
      total_assets: 2000,
      total_debt: 400,
      shareholders_equity: 1200,
      cash_and_equivalents: 200,
      retained_earnings: 900,
      current_assets: 600,
      current_liabilities: 300,
      income_before_tax: 200,
      income_tax_expense: 40,
      shares_diluted: 100,
      dividends_paid: 20,
      common_stock_repurchased: 40,
    },
    marketCap: 6000,
    beta: 1.0,
  };
  const inputs = [
    makeInputs("T1", 4, tmpl),
    makeInputs("T2", 4, tmpl),
    makeInputs("T3", 4, tmpl),
  ];
  const results = computeQForCohort(inputs);
  for (const r of results) {
    assert.equal(r.qScore, 50, `${r.ticker} should be 50 in an all-equal cohort`);
  }
});

test("computeQForCohort: single-ticker cohort returns 50 (degenerate)", () => {
  const only = makeInputs("SOLO", 4, {
    current: {
      revenue: 1000,
      gross_profit: 500,
      operating_income: 200,
      net_income: 160,
      fcf: 180,
      total_assets: 2000,
      total_debt: 400,
      shareholders_equity: 1200,
      cash_and_equivalents: 200,
      retained_earnings: 900,
      current_assets: 600,
      current_liabilities: 300,
      income_before_tax: 200,
      income_tax_expense: 40,
      shares_diluted: 100,
      dividends_paid: 20,
      common_stock_repurchased: 40,
    },
    marketCap: 6000,
    beta: 1.0,
  });
  const r = computeQForCohort([only])[0];
  assert.equal(r.qScore, 50);
  // All pillar z-scores should be 0 (single-name cohort, no spread).
  assert.equal(r.pillars.profitability, 0);
  assert.equal(r.pillars.payout, 0);
});

test("computeQForCohort: missing metric on a ticker doesn't poison its qScore", () => {
  // T1 has a fully-specified row; T2 is missing payout components but has the
  // others. Both should still get a finite qScore.
  const t1 = makeInputs("T1", 1, {
    current: {
      revenue: 1000,
      gross_profit: 500,
      operating_income: 200,
      net_income: 160,
      fcf: 180,
      total_assets: 2000,
      total_debt: 400,
      shareholders_equity: 1200,
      cash_and_equivalents: 200,
      retained_earnings: 900,
      current_assets: 600,
      current_liabilities: 300,
      income_before_tax: 200,
      income_tax_expense: 40,
      shares_diluted: 100,
      dividends_paid: 20,
      common_stock_repurchased: 40,
    },
    marketCap: 6000,
  });
  const t2 = makeInputs("T2", 1, {
    current: {
      revenue: 1000,
      gross_profit: 500,
      operating_income: 200,
      net_income: 160,
      fcf: 180,
      total_assets: 2000,
      total_debt: 400,
      shareholders_equity: 1200,
      cash_and_equivalents: 200,
      retained_earnings: 900,
      current_assets: 600,
      current_liabilities: 300,
      income_before_tax: 200,
      income_tax_expense: 40,
      shares_diluted: 100,
      dividends_paid: null,
      common_stock_repurchased: null,
    },
    marketCap: 6000,
  });
  const results = computeQForCohort([t1, t2]);
  for (const r of results) {
    assert.ok(r.qScore !== null && Number.isFinite(r.qScore));
  }
  // T2's payout pillar is null (no metric available for it); T1's is a valid z.
  assert.equal(results.find((r) => r.ticker === "T2")!.pillars.payout, null);
  assert.ok(results.find((r) => r.ticker === "T1")!.pillars.payout !== null);
});

test("computeQForCohort: layer rule applied (L3 halves payout weight)", () => {
  // Two identical inputs in L3 (payout halved) vs L4 (full payout).
  // The composite_z formula differs only via the pillar weights, so identical
  // raw inputs in a 1-ticker cohort still produce zero composite-z (no spread)
  // and qScore = 50 either way. The check we *can* run cheaply: pillarWeights
  // sums to 1 for both layers and the payout weight matches the rule.
  const w3 = _internals.pillarWeights(3);
  const w4 = _internals.pillarWeights(4);
  assert.equal(w3.payout, 0.125);
  assert.equal(w4.payout, 0.25);
  assert.equal(w3.profitability + w3.growth + w3.safety + w3.payout, 1);
  assert.equal(w4.profitability + w4.growth + w4.safety + w4.payout, 1);
});

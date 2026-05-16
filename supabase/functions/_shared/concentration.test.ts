import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeConcentrationTax,
  meanPairwiseCorrelation,
  pc1LoadingsAbs,
  pearsonCorrelation,
  TAX_CAP,
} from "./concentration.ts";

// Deterministic PRNG for reproducible synthetic returns.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
function gaussian(rng: () => number, mu = 0, sigma = 1): number {
  // Box-Muller.
  const u = Math.max(1e-12, rng());
  const v = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

test("pearsonCorrelation: identical series → 1", () => {
  const xs = Array.from({ length: 30 }, (_, i) => i);
  assert.ok(Math.abs(pearsonCorrelation(xs, xs) - 1) < 1e-12);
});

test("pearsonCorrelation: negatively-related series → -1", () => {
  const xs = Array.from({ length: 30 }, (_, i) => i);
  const ys = xs.map((x) => -x);
  assert.ok(Math.abs(pearsonCorrelation(xs, ys) + 1) < 1e-12);
});

test("pearsonCorrelation: zero-variance series → 0", () => {
  const flat = Array(30).fill(5);
  const ramp = Array.from({ length: 30 }, (_, i) => i);
  assert.equal(pearsonCorrelation(flat, ramp), 0);
});

test("meanPairwiseCorrelation: independent series have ~0 pairwise mean", () => {
  const rng = lcg(42);
  const tickers = ["A", "B", "C", "D"];
  const returns = tickers.map(() => Array.from({ length: 250 }, () => gaussian(rng, 0, 0.02)));
  const mp = meanPairwiseCorrelation(tickers, returns);
  for (const t of tickers) {
    assert.ok(Math.abs(mp.get(t)!) < 0.15, `${t}: expected near-zero, got ${mp.get(t)}`);
  }
});

test("pc1LoadingsAbs: all tickers loading on a common factor concentrate weight", () => {
  // Build a universe where every ticker is 90% the same factor + 10% idiosyncratic.
  const rng = lcg(7);
  const T = 250;
  const factor = Array.from({ length: T }, () => gaussian(rng, 0, 0.02));
  const tickers = ["A", "B", "C", "D"];
  const returns = tickers.map(() => factor.map((f) => 0.9 * f + 0.1 * gaussian(rng, 0, 0.02)));
  const pc1 = pc1LoadingsAbs(tickers, returns);
  // Sum of squared loadings should equal 1 (unit eigenvector).
  let sumSq = 0;
  for (const v of pc1.values()) sumSq += v * v;
  assert.ok(Math.abs(sumSq - 1) < 1e-6, `expected unit norm, got ${sumSq}`);
  // Each loading should be near 0.5 (≈ 1/sqrt(4)).
  for (const t of tickers) {
    assert.ok(Math.abs(pc1.get(t)! - 0.5) < 0.1, `${t} loading off: ${pc1.get(t)}`);
  }
});

test("computeConcentrationTax: 5-ticker synthetic — most-correlated name gets the deepest tax", () => {
  // Build 5 tickers where 'CROWD' is 95% factor and the rest are 30% factor.
  const rng = lcg(11);
  const T = 250;
  const factor = Array.from({ length: T }, () => gaussian(rng, 0, 0.02));
  const returns = new Map<string, number[]>();
  returns.set("CROWD", factor.map((f) => 0.95 * f + 0.05 * gaussian(rng, 0, 0.02)));
  for (const t of ["A", "B", "C", "D"]) {
    returns.set(t, factor.map((f) => 0.3 * f + 0.7 * gaussian(rng, 0, 0.02)));
  }
  const supplyChainDegree = new Map<string, number>([["CROWD", 4], ["A", 1], ["B", 0], ["C", 0], ["D", 0]]);

  const out = computeConcentrationTax({ returns, supplyChainDegree });
  const byTicker = new Map(out.map((x) => [x.ticker, x]));
  const crowd = byTicker.get("CROWD")!;
  // CROWD should have the deepest (most negative) tax.
  for (const t of ["A", "B", "C", "D"]) {
    const other = byTicker.get(t)!;
    assert.ok(
      crowd.tax <= other.tax,
      `CROWD tax (${crowd.tax}) should be ≤ ${t} tax (${other.tax})`,
    );
  }
  // CROWD should approach the cap; A/B/C/D should be near zero.
  assert.ok(crowd.tax < -8, `CROWD tax (${crowd.tax}) should be substantially below 0`);
});

test("computeConcentrationTax: tax is bounded in [TAX_CAP, 0]", () => {
  const rng = lcg(13);
  const T = 250;
  const factor = Array.from({ length: T }, () => gaussian(rng, 0, 0.02));
  const returns = new Map<string, number[]>();
  for (const t of ["A", "B", "C", "D", "E"]) {
    returns.set(t, factor.map((f) => 0.95 * f + 0.05 * gaussian(rng, 0, 0.02)));
  }
  const supplyChainDegree = new Map<string, number>();

  const out = computeConcentrationTax({ returns, supplyChainDegree });
  for (const r of out) {
    assert.ok(r.tax <= 0, `${r.ticker}: tax > 0`);
    assert.ok(r.tax >= TAX_CAP, `${r.ticker}: tax < cap`);
  }
});

test("computeConcentrationTax: insufficient returns history → all zero taxes", () => {
  const returns = new Map<string, number[]>();
  returns.set("A", [0.01, 0.02]); // way under 30 days
  returns.set("B", [0.01, 0.02]);
  const out = computeConcentrationTax({ returns, supplyChainDegree: new Map() });
  for (const r of out) assert.equal(r.tax, 0);
});

test("computeConcentrationTax acceptance: NVDA-like name (high corr + PC1 + supply chain) gets deep tax; TSM-like name shallow", () => {
  // Build a small universe approximating spec rationale:
  //   NVDA: 95% factor (universe leader, drives PC1, broad supply chain)
  //   MSFT/AMZN/GOOGL/META: 80% factor (hyperscalers, depend on NVDA)
  //   TSM: 35% factor (cap-eq vendor, less directly tracks Nvidia)
  //   AVGO/ASML: 60% factor
  //   CRWD/SNOW: 25% factor (app layer, somewhat decoupled)
  const rng = lcg(19);
  const T = 120; // 120-day window per spec
  const factor = Array.from({ length: T }, () => gaussian(rng, 0, 0.02));
  function ret(loading: number): number[] {
    return factor.map((f) => loading * f + (1 - loading) * gaussian(rng, 0, 0.02));
  }
  const returns = new Map<string, number[]>([
    ["NVDA", ret(0.95)],
    ["MSFT", ret(0.80)],
    ["AMZN", ret(0.80)],
    ["GOOGL", ret(0.80)],
    ["META", ret(0.80)],
    ["AVGO", ret(0.60)],
    ["ASML", ret(0.60)],
    ["TSM", ret(0.35)],
    ["CRWD", ret(0.25)],
    ["SNOW", ret(0.25)],
  ]);
  // Hand-curated supply-chain degree (inbound + outbound). TSM is a
  // single-supplier node (one upstream chain, no downstream in our
  // slate); NVDA sits at the most-central node (4 hyperscaler customers
  // + 1 supplier).
  const supplyChainDegree = new Map<string, number>([
    ["NVDA", 5], // supplier: TSM; customers: 4 hyperscalers
    ["TSM", 1],  // node in the chain but not central within the slate
    ["ASML", 2],
    ["AVGO", 1],
    ["MSFT", 1], ["AMZN", 1], ["GOOGL", 1], ["META", 1],
    ["CRWD", 0], ["SNOW", 0],
  ]);

  const out = computeConcentrationTax({ returns, supplyChainDegree });
  const byTicker = new Map(out.map((x) => [x.ticker, x.tax]));
  const nvda = byTicker.get("NVDA")!;
  const tsm = byTicker.get("TSM")!;

  // Spec acceptance: NVDA tax much more negative than TSM tax.
  assert.ok(nvda < tsm - 3, `NVDA (${nvda}) should be at least 3pt deeper than TSM (${tsm})`);
  // NVDA pulls toward the deep end (high on all three signals).
  assert.ok(nvda <= -4, `NVDA tax should be ≤ -4, got ${nvda}`);
  // TSM should be shallow (low on supply-chain rank, moderate elsewhere).
  // Note: percentile-rank in a 10-name universe is coarser than in the
  // real 50-name universe; absolute targets here are sanity checks, not
  // production calibration.
  assert.ok(tsm >= -6, `TSM tax should be ≥ -6 in this small fixture; got ${tsm}`);
});

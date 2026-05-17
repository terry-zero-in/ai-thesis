import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adjustedFcfYield,
  computeVForCohort,
  ebitda,
  enterpriseValue,
  maintenanceCapexMid,
  ownHistoryForwardPeZ,
  pegLike,
  type Layer,
  type VInputs,
} from "./factor-v.ts";

const baseInputs: Omit<VInputs, "ticker" | "layer"> = {
  ttmRevenue: null,
  ttmOperatingIncome: null,
  ttmDepreciationAmortization: null,
  ttmFcf: null,
  ttmCapex: null,
  latestTotalDebt: null,
  latestCash: null,
  marketCap: null,
  ntmRevenue: null,
  forwardPeToday: null,
  forwardPeHistory: [],
  depreciationPenalty: 0,
};
const inp = (ticker: string, layer: Layer, over: Partial<VInputs>): VInputs => ({
  ...baseInputs,
  ticker,
  layer,
  ...over,
});

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

// ─── Primitives ─────────────────────────────────────────────────────────────

test("ebitda: op_income + D&A", () => {
  assert.equal(ebitda(100, 25), 125);
});
test("ebitda: missing → null", () => {
  assert.equal(ebitda(null, 25), null);
  assert.equal(ebitda(100, null), null);
});

test("enterpriseValue: mcap + debt - cash", () => {
  assert.equal(enterpriseValue(1000, 200, 150), 1050);
});
test("enterpriseValue: non-positive → null", () => {
  assert.equal(enterpriseValue(100, 0, 200), null);
});
test("enterpriseValue: missing component → null", () => {
  assert.equal(enterpriseValue(null, 200, 150), null);
  assert.equal(enterpriseValue(1000, null, 150), null);
  assert.equal(enterpriseValue(1000, 200, null), null);
});

test("pegLike: ev_ebitda / growth", () => {
  // EV = 1000, EBITDA = 100, growth = 0.25 → ev_ebitda = 10 → PEG = 40
  approx(pegLike(1000, 100, 0.25)!, 40);
});
test("pegLike: zero or negative growth → null", () => {
  assert.equal(pegLike(1000, 100, 0), null);
  assert.equal(pegLike(1000, 100, -0.05), null);
});
test("pegLike: zero or negative EBITDA → null", () => {
  assert.equal(pegLike(1000, 0, 0.2), null);
  assert.equal(pegLike(1000, -50, 0.2), null);
});

test("maintenanceCapexMid: 50% of capex", () => {
  assert.equal(maintenanceCapexMid(800), 400);
  assert.equal(maintenanceCapexMid(null), null);
});

test("adjustedFcfYield: (fcf + (capex - maint)) / EV", () => {
  // fcf 300, capex 800, maintenance 400, EV 5000
  // (300 + (800-400)) / 5000 = 700/5000 = 0.14
  approx(adjustedFcfYield(300, 800, 5000, 400)!, 0.14);
});
test("adjustedFcfYield: maintenance defaults to mid (50% capex)", () => {
  approx(adjustedFcfYield(300, 800, 5000, maintenanceCapexMid(800)!)!, 0.14);
});
test("adjustedFcfYield: missing inputs → null", () => {
  assert.equal(adjustedFcfYield(null, 800, 5000, 400), null);
  assert.equal(adjustedFcfYield(300, null, 5000, 400), null);
  assert.equal(adjustedFcfYield(300, 800, 0, 400), null);
  assert.equal(adjustedFcfYield(300, 800, null, 400), null);
});

// ─── Own-history forward P/E z ──────────────────────────────────────────────

test("ownHistoryForwardPeZ: <90 obs → null + confidence=none", () => {
  const r = ownHistoryForwardPeZ(20, [18, 19, 20]);
  assert.equal(r.z, null);
  assert.equal(r.confidence, "none");
  assert.equal(r.obs, 3);
});

test("ownHistoryForwardPeZ: 90-365 obs → z computed, confidence=low", () => {
  // 100 obs all equal to 20; today = 25.
  // std = 0 → z falls through to null even though confidence band is low.
  const history = Array(100).fill(20);
  const r = ownHistoryForwardPeZ(25, history);
  assert.equal(r.confidence, "low");
  assert.equal(r.obs, 100);
  // With zero std, z is null (degenerate); meanVal still 20.
  assert.equal(r.z, null);
  assert.equal(r.meanVal, 20);
});

test("ownHistoryForwardPeZ: 365+ obs with variance → full confidence", () => {
  const history: number[] = [];
  for (let i = 0; i < 400; i++) history.push(20 + Math.sin(i / 10));
  const r = ownHistoryForwardPeZ(22, history);
  assert.equal(r.confidence, "full");
  assert.equal(r.obs, 400);
  assert.ok(r.z !== null && Number.isFinite(r.z));
});

test("ownHistoryForwardPeZ: window caps at 5y = 1260 obs", () => {
  const history: number[] = [];
  for (let i = 0; i < 1500; i++) history.push(20 + Math.sin(i / 20));
  const r = ownHistoryForwardPeZ(22, history);
  assert.equal(r.obs, 1260);
  assert.equal(r.confidence, "full");
});

test("ownHistoryForwardPeZ: ignores null entries in history", () => {
  const history: Array<number | null> = [];
  for (let i = 0; i < 100; i++) history.push(i % 5 === 0 ? null : 20);
  // 80 finite obs after filtering → still < 90 → confidence none
  const r = ownHistoryForwardPeZ(22, history);
  assert.equal(r.confidence, "none");
  assert.equal(r.obs, 80);
});

test("ownHistoryForwardPeZ: today null → null, confidence none", () => {
  const r = ownHistoryForwardPeZ(null, Array(500).fill(20));
  assert.equal(r.confidence, "none");
});

// ─── Cohort assembly: penalty + sign discipline ─────────────────────────────

test("computeVForCohort: rejects mixed layers", () => {
  const a = inp("A", 1, { ttmRevenue: 1000, marketCap: 5000 });
  const b = inp("B", 2, { ttmRevenue: 1000, marketCap: 5000 });
  assert.throws(() => computeVForCohort([a, b]), /layer/);
});

test("computeVForCohort: penalty clamped to [−12, 0]", () => {
  const x = inp("X", 1, {
    ttmRevenue: 1000, ttmOperatingIncome: 200, ttmDepreciationAmortization: 50,
    ttmFcf: 150, ttmCapex: 100,
    latestTotalDebt: 100, latestCash: 200, marketCap: 5000,
    ntmRevenue: 1200,
    depreciationPenalty: -50, // way out of bounds
  });
  const r = computeVForCohort([x])[0];
  assert.equal(r.penalty, -12);
});

test("computeVForCohort: positive penalty defensively zeroed", () => {
  const x = inp("X", 1, { depreciationPenalty: 5 });
  const r = computeVForCohort([x])[0];
  assert.equal(r.penalty, 0);
});

test("computeVForCohort: cheaper-on-every-signal ticker ranks highest", () => {
  // Three L1 names. CHEAP: low PEG, high FCF yield, low fwd-PE-vs-history.
  // RICH: opposite. AVG: in the middle. Tied histories so own-PE-z is
  // null for all (no impact); ranking driven by PEG and FCF.
  const cheap = inp("CHEAP", 1, {
    ttmRevenue: 1000, ttmOperatingIncome: 300, ttmDepreciationAmortization: 50,
    ttmFcf: 200, ttmCapex: 100,
    latestTotalDebt: 100, latestCash: 200, marketCap: 2000,
    ntmRevenue: 1300, // 30% NTM growth
  });
  const avg = inp("AVG", 1, {
    ttmRevenue: 1000, ttmOperatingIncome: 200, ttmDepreciationAmortization: 40,
    ttmFcf: 100, ttmCapex: 150,
    latestTotalDebt: 200, latestCash: 100, marketCap: 4000,
    ntmRevenue: 1150,
  });
  const rich = inp("RICH", 1, {
    ttmRevenue: 1000, ttmOperatingIncome: 150, ttmDepreciationAmortization: 30,
    ttmFcf: 50, ttmCapex: 200,
    latestTotalDebt: 300, latestCash: 100, marketCap: 9000,
    ntmRevenue: 1050,
  });
  const results = computeVForCohort([cheap, avg, rich]);
  const by = Object.fromEntries(results.map((r) => [r.ticker, r]));
  for (const r of results) {
    assert.ok(r.vScore !== null && r.vScore >= 0 && r.vScore <= 100);
  }
  assert.ok(by["CHEAP"].vScore! > by["AVG"].vScore!);
  assert.ok(by["AVG"].vScore! > by["RICH"].vScore!);
});

test("computeVForCohort: penalty subtracts from raw_v", () => {
  // Single-ticker cohort: raw_v = 50; with penalty −10, vScore = 40.
  const x = inp("X", 1, {
    ttmRevenue: 1000, ttmOperatingIncome: 200, ttmDepreciationAmortization: 50,
    ttmFcf: 150, ttmCapex: 100,
    latestTotalDebt: 100, latestCash: 200, marketCap: 5000,
    ntmRevenue: 1200,
    depreciationPenalty: -10,
  });
  const r = computeVForCohort([x])[0];
  assert.equal(r.rawV, 50);
  assert.equal(r.vScore, 40);
});

test("computeVForCohort: vScore floored at 0 after penalty", () => {
  // Single-ticker cohort with max penalty: raw_v=50, penalty=−12 → 38.
  // To floor at 0 we'd need raw_v < 12. Force that by making the ticker
  // worst in a richer cohort... actually easier: use a low-rank ticker.
  // Two-ticker cohort where X is the worse one (rank 0/1 = 0 in ties, but
  // ties use midpoint = 25). Force a real spread:
  const a = inp("A", 1, {
    ttmRevenue: 1000, ttmOperatingIncome: 500, ttmDepreciationAmortization: 100,
    ttmFcf: 400, ttmCapex: 100,
    latestTotalDebt: 0, latestCash: 500, marketCap: 1000,
    ntmRevenue: 1500,
  });
  const b = inp("B", 1, {
    ttmRevenue: 1000, ttmOperatingIncome: 100, ttmDepreciationAmortization: 20,
    ttmFcf: 50, ttmCapex: 300,
    latestTotalDebt: 800, latestCash: 50, marketCap: 8000,
    ntmRevenue: 1020,
    depreciationPenalty: -12,
  });
  const r = computeVForCohort([a, b]);
  const bRes = r.find((x) => x.ticker === "B")!;
  // bRes.rawV will be a low percentile, then penalty −12 may push below 0.
  assert.ok(bRes.vScore! >= 0, `vScore floored at 0, got ${bRes.vScore}`);
});

test("computeVForCohort: missing TTM data → vScore null", () => {
  const empty = inp("EMPTY", 1, {});
  const real = inp("REAL", 1, {
    ttmRevenue: 1000, ttmOperatingIncome: 200, ttmDepreciationAmortization: 50,
    ttmFcf: 150, ttmCapex: 100,
    latestTotalDebt: 100, latestCash: 200, marketCap: 5000,
    ntmRevenue: 1200,
  });
  const r = computeVForCohort([empty, real]);
  const by = Object.fromEntries(r.map((x) => [x.ticker, x]));
  assert.equal(by["EMPTY"].vScore, null);
  assert.ok(by["REAL"].vScore !== null);
});

test("computeVForCohort: own-history confidence carried into signals", () => {
  const history: number[] = [];
  for (let i = 0; i < 500; i++) history.push(20 + Math.sin(i / 8));
  const x = inp("X", 1, {
    ttmRevenue: 1000, ttmOperatingIncome: 200, ttmDepreciationAmortization: 50,
    ttmFcf: 150, ttmCapex: 100,
    latestTotalDebt: 100, latestCash: 200, marketCap: 5000,
    ntmRevenue: 1200,
    forwardPeToday: 22,
    forwardPeHistory: history,
  });
  const r = computeVForCohort([x])[0];
  assert.equal(r.signals.forwardPeConfidence, "full");
  assert.equal(r.signals.forwardPeObs, 500);
  assert.ok(r.signals.ownHistoryFwdPeZ !== null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeMForCohort,
  computeSue,
  price12_1,
  revisionBreadth,
  type Layer,
  type MInputs,
} from "./factor-m.ts";

function baseInput(ticker: string, layer: Layer = 1): MInputs {
  return {
    ticker,
    layer,
    close_13mo: null,
    close_1mo: null,
    actual_eps_latest: null,
    expected_eps_at_report: null,
    upward_breadth_pct: null,
  };
}

// ─── Signal-level math ──────────────────────────────────────────────────────

test("price12_1 returns null when either close is missing or non-positive", () => {
  assert.equal(price12_1(baseInput("X")), null);
  assert.equal(price12_1({ ...baseInput("X"), close_13mo: 0, close_1mo: 110 }), null);
  assert.equal(price12_1({ ...baseInput("X"), close_13mo: -50, close_1mo: 110 }), null);
});

test("price12_1 computes total return over the window", () => {
  const r = price12_1({ ...baseInput("X"), close_13mo: 100, close_1mo: 134 });
  assert.ok(r !== null && Math.abs(r - 0.34) < 1e-9);
});

test("computeSue handles missing inputs and the 1¢ floor", () => {
  assert.equal(computeSue(baseInput("X")), null);
  // tiny expected EPS: |expected| floors at 0.01
  const tinyDenom = computeSue({ ...baseInput("X"), actual_eps_latest: 0.05, expected_eps_at_report: 0.001 });
  assert.ok(tinyDenom !== null && Math.abs(tinyDenom - (0.05 - 0.001) / 0.01) < 1e-9);
  // normal case
  const normal = computeSue({ ...baseInput("X"), actual_eps_latest: 1.20, expected_eps_at_report: 1.00 });
  assert.ok(normal !== null && Math.abs(normal - 0.20) < 1e-9);
  // negative expected — abs() in denominator still works
  const neg = computeSue({ ...baseInput("X"), actual_eps_latest: -0.10, expected_eps_at_report: -0.50 });
  assert.ok(neg !== null && Math.abs(neg - ((-0.10 - -0.50) / 0.50)) < 1e-9);
});

test("revisionBreadth scales 0..100 → 0..1", () => {
  assert.equal(revisionBreadth({ ...baseInput("X"), upward_breadth_pct: 65 }), 0.65);
  assert.equal(revisionBreadth(baseInput("X")), null);
});

// ─── Cohort scoring ─────────────────────────────────────────────────────────

test("computeMForCohort: empty input returns []", () => {
  assert.deepEqual(computeMForCohort([]), []);
});

test("computeMForCohort: all-missing tickers get null mScore but stay in the result list", () => {
  const r = computeMForCohort([baseInput("X"), baseInput("Y")]);
  assert.equal(r.length, 2);
  assert.equal(r[0].mScore, null);
  assert.equal(r[1].mScore, null);
  assert.equal(r[0].compositeZ, null);
});

test("computeMForCohort: highest signal triplet ranks highest", () => {
  const inputs: MInputs[] = [
    { ...baseInput("A"), close_13mo: 100, close_1mo: 200, actual_eps_latest: 2.0, expected_eps_at_report: 1.0, upward_breadth_pct: 80 },
    { ...baseInput("B"), close_13mo: 100, close_1mo: 120, actual_eps_latest: 1.1, expected_eps_at_report: 1.0, upward_breadth_pct: 50 },
    { ...baseInput("C"), close_13mo: 100, close_1mo: 90, actual_eps_latest: 0.9, expected_eps_at_report: 1.0, upward_breadth_pct: 30 },
  ];
  const r = computeMForCohort(inputs);
  const byTicker = new Map(r.map((x) => [x.ticker, x]));
  assert.ok((byTicker.get("A")!.mScore ?? 0) > (byTicker.get("B")!.mScore ?? 0));
  assert.ok((byTicker.get("B")!.mScore ?? 0) > (byTicker.get("C")!.mScore ?? 0));
});

test("computeMForCohort: partial signal coverage rescales weights, doesn't penalize", () => {
  // Two tickers with strong price but missing SUE — they should rank
  // similarly even though one has the breadth signal too.
  const inputs: MInputs[] = [
    { ...baseInput("A"), close_13mo: 100, close_1mo: 200, upward_breadth_pct: 80 },
    { ...baseInput("B"), close_13mo: 100, close_1mo: 90, upward_breadth_pct: 30 },
    { ...baseInput("C"), close_13mo: 100, close_1mo: 100, upward_breadth_pct: 55 },
  ];
  const r = computeMForCohort(inputs);
  // None should be null since each has 2/3 signals.
  for (const x of r) {
    assert.ok(x.mScore !== null);
    assert.ok(x.compositeZ !== null);
  }
});

test("computeMForCohort: SUE-only ticker still scores (rescaled weights)", () => {
  const inputs: MInputs[] = [
    { ...baseInput("A"), actual_eps_latest: 2.0, expected_eps_at_report: 1.0 },
    { ...baseInput("B"), actual_eps_latest: 1.0, expected_eps_at_report: 1.0 },
    { ...baseInput("C"), actual_eps_latest: 0.5, expected_eps_at_report: 1.0 },
  ];
  const r = computeMForCohort(inputs);
  for (const x of r) assert.ok(x.mScore !== null);
  // A should rank highest since it has the largest surprise.
  const byTicker = new Map(r.map((x) => [x.ticker, x]));
  assert.ok((byTicker.get("A")!.mScore ?? 0) > (byTicker.get("C")!.mScore ?? 0));
});

test("computeMForCohort: degenerate one-name cohort returns finite (50-ish) score", () => {
  const r = computeMForCohort([
    { ...baseInput("A"), close_13mo: 100, close_1mo: 110, actual_eps_latest: 1.0, expected_eps_at_report: 1.0, upward_breadth_pct: 55 },
  ]);
  assert.equal(r.length, 1);
  // Single name in cohort → z = 0 → percentile rank = 50.
  assert.equal(r[0].mScore, 50);
});

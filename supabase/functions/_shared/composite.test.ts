import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAYER_WEIGHTS,
  classifyTier,
  computeComposite,
  countMacroGates,
  macroMultiplier,
  type Layer,
  type FactorScores,
  type MacroGauges,
} from "./composite.ts";

const noGauges: MacroGauges = { naaim: null, aaii_3wk_spread: null, fear_greed: null };

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

// ─── Layer weights table ────────────────────────────────────────────────────

test("LAYER_WEIGHTS: every row sums to 1.0", () => {
  for (const layer of [1, 2, 3, 4, 5] as Layer[]) {
    const w = LAYER_WEIGHTS[layer];
    const sum = w.Q + w.G + w.V + w.AIQ + w.M + w.S;
    approx(sum, 1.0, 1e-12);
  }
});

// ─── Macro gate (§Fix 4) ────────────────────────────────────────────────────

test("countMacroGates: 0 gates", () => {
  assert.equal(countMacroGates({ naaim: 80, aaii_3wk_spread: 10, fear_greed: 60 }), 0);
});
test("countMacroGates: 1 gate (NAAIM)", () => {
  assert.equal(countMacroGates({ naaim: 96, aaii_3wk_spread: 10, fear_greed: 60 }), 1);
});
test("countMacroGates: 2 gates (NAAIM + AAII)", () => {
  assert.equal(countMacroGates({ naaim: 96, aaii_3wk_spread: 35, fear_greed: 60 }), 2);
});
test("countMacroGates: 3 gates", () => {
  assert.equal(countMacroGates({ naaim: 96, aaii_3wk_spread: 35, fear_greed: 85 }), 3);
});
test("countMacroGates: nulls don't count", () => {
  assert.equal(countMacroGates({ naaim: null, aaii_3wk_spread: null, fear_greed: null }), 0);
});
test("countMacroGates: gates use strict > (boundary)", () => {
  // Exactly at threshold = NOT hit.
  assert.equal(countMacroGates({ naaim: 90, aaii_3wk_spread: 30, fear_greed: 80 }), 0);
});

test("macroMultiplier: spec table", () => {
  assert.equal(macroMultiplier(noGauges).multiplier, 1.00);
  assert.equal(macroMultiplier({ naaim: 96, aaii_3wk_spread: 0, fear_greed: 0 }).multiplier, 0.95);
  assert.equal(macroMultiplier({ naaim: 96, aaii_3wk_spread: 35, fear_greed: 0 }).multiplier, 0.90);
  assert.equal(macroMultiplier({ naaim: 96, aaii_3wk_spread: 35, fear_greed: 85 }).multiplier, 0.85);
});

// ─── Tier classifier ───────────────────────────────────────────────────────

test("classifyTier: cut-points (≥75 High, ≥60 Medium, ≥45 Low, <45 Avoid)", () => {
  assert.equal(classifyTier(85), "High");
  assert.equal(classifyTier(75), "High");
  assert.equal(classifyTier(74.99), "Medium");
  assert.equal(classifyTier(60), "Medium");
  assert.equal(classifyTier(59.99), "Low");
  assert.equal(classifyTier(45), "Low");
  assert.equal(classifyTier(44.99), "Avoid");
  assert.equal(classifyTier(0), "Avoid");
});
test("classifyTier: null/NaN → null", () => {
  assert.equal(classifyTier(null), null);
  assert.equal(classifyTier(Number.NaN), null);
});

// ─── computeComposite: Tier-A rescale + macro multiplier + tier ─────────────

test("computeComposite: Tier-A rescale when M and S null", () => {
  // L1: Q=22, G=26, V=14, AIQ=18, M=12, S=8. With M+S null, rescale
  // Q+G+V+AIQ (sum=80) to sum 1.0 → Q=0.275, G=0.325, V=0.175, AIQ=0.225.
  const scores: FactorScores = { q: 80, g: 70, v: 50, aiq: 60, m: null, s: null };
  const r = computeComposite("T", 1, scores, noGauges);
  // 0.275*80 + 0.325*70 + 0.175*50 + 0.225*60 = 22 + 22.75 + 8.75 + 13.5 = 67.0
  approx(r.composite!, 67.0);
  assert.equal(r.tier, "Medium");
  approx(r.resolvedWeights.q!, 0.275);
});

test("computeComposite: full 6-factor weighting when M and S present", () => {
  // L1, full weights: 22, 26, 14, 18, 12, 8.
  const scores: FactorScores = { q: 80, g: 70, v: 50, aiq: 60, m: 65, s: 55 };
  const r = computeComposite("T", 1, scores, noGauges);
  approx(
    r.composite!,
    0.22 * 80 + 0.26 * 70 + 0.14 * 50 + 0.18 * 60 + 0.12 * 65 + 0.08 * 55,
  );
});

test("computeComposite: macro multiplier applied only to High composites", () => {
  // L4 weights: 30, 22, 18, 14, 10, 6. With M+S null, rescale among Q/G/V/AIQ
  // (sum=84). With high scores driving above 75:
  const scores: FactorScores = { q: 90, g: 85, v: 80, aiq: 80, m: null, s: null };
  // Three gates hit → multiplier 0.85.
  const gauges: MacroGauges = { naaim: 96, aaii_3wk_spread: 35, fear_greed: 85 };
  const r = computeComposite("T", 4, scores, gauges);
  assert.ok(r.composite! >= 75);
  approx(r.finalScore!, r.composite! * 0.85);
  assert.equal(r.macroGatesHit, 3);
  assert.equal(r.macroMultiplier, 0.85);
});

test("computeComposite: multiplier NOT applied when composite < 75", () => {
  const scores: FactorScores = { q: 60, g: 55, v: 50, aiq: 60, m: null, s: null };
  const gauges: MacroGauges = { naaim: 96, aaii_3wk_spread: 35, fear_greed: 85 };
  const r = computeComposite("T", 1, scores, gauges);
  assert.ok(r.composite! < 75);
  // finalScore equals composite — multiplier left unapplied.
  approx(r.finalScore!, r.composite!);
});

test("computeComposite: a High composite can be derated into Medium", () => {
  // Targeted: composite = ~76, multiplier = 0.95 → finalScore = ~72.2 → Medium.
  const scores: FactorScores = { q: 76, g: 76, v: 76, aiq: 76, m: null, s: null };
  const gauges: MacroGauges = { naaim: 96, aaii_3wk_spread: 0, fear_greed: 0 }; // 1 gate
  const r = computeComposite("T", 1, scores, gauges);
  approx(r.composite!, 76);
  approx(r.finalScore!, 76 * 0.95);
  assert.equal(r.tier, "Medium");
});

test("computeComposite: dropping a missing factor rescales remaining weights", () => {
  // L1, AIQ null. The remaining factors Q/G/V (M/S also null) should
  // rescale their weights to sum to 1.0 from base 0.22+0.26+0.14 = 0.62.
  const scores: FactorScores = { q: 50, g: 50, v: 50, aiq: null, m: null, s: null };
  const r = computeComposite("T", 1, scores, noGauges);
  approx(r.composite!, 50);
  approx(r.resolvedWeights.q!, 0.22 / 0.62, 1e-12);
  approx(r.resolvedWeights.g!, 0.26 / 0.62, 1e-12);
  approx(r.resolvedWeights.v!, 0.14 / 0.62, 1e-12);
  assert.equal(r.resolvedWeights.aiq, undefined);
});

test("computeComposite: every factor null → composite null", () => {
  const scores: FactorScores = { q: null, g: null, v: null, aiq: null, m: null, s: null };
  const r = computeComposite("T", 1, scores, noGauges);
  assert.equal(r.composite, null);
  assert.equal(r.finalScore, null);
  assert.equal(r.tier, null);
});

test("computeComposite: NaN treated as null (won't poison composite)", () => {
  const scores: FactorScores = { q: Number.NaN, g: 70, v: 50, aiq: 60, m: null, s: null };
  const r = computeComposite("T", 1, scores, noGauges);
  // q dropped; remaining G/V/AIQ rescale among themselves
  // weights G=0.26, V=0.14, AIQ=0.18 sum=0.58.
  approx(
    r.composite!,
    (0.26 / 0.58) * 70 + (0.14 / 0.58) * 50 + (0.18 / 0.58) * 60,
    1e-12,
  );
});

test("computeComposite: deterministic — same inputs produce same outputs", () => {
  const scores: FactorScores = { q: 80, g: 70, v: 50, aiq: 60, m: null, s: null };
  const r1 = computeComposite("T", 1, scores, noGauges);
  const r2 = computeComposite("T", 1, scores, noGauges);
  assert.deepEqual(r1, r2);
});

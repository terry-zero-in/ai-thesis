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

// THS-50 acceptance: the spec-cited May 14 2026 reading exercises the exact
// "1 gate hit → 0.95" path with the live-ingest-shaped values. NAAIM 96.67
// trips the > 90 gate; AAII 5.36 is well below 30; F&G 66 is below 80.
test("macroMultiplier: spec May 14 2026 reading (NAAIM 96.67, AAII 5.36, F&G 66) → 0.95", () => {
  const { multiplier, gatesHit } = macroMultiplier({
    naaim: 96.67,
    aaii_3wk_spread: 5.36,
    fear_greed: 66,
  });
  assert.equal(gatesHit, 1);
  assert.equal(multiplier, 0.95);
});

// THS-50 wiring: a High composite under the spec gauges should de-rate by 0.95
// and the resulting tier should follow the de-rated score, not the raw one.
test("computeComposite: May 14 gauges de-rate a High name; Medium-borderline drops tier", () => {
  const gauges: MacroGauges = { naaim: 96.67, aaii_3wk_spread: 5.36, fear_greed: 66 };

  // High name well above 75 stays High after 0.95.
  const high = computeComposite("X", 1, { q: 90, g: 90, v: 90, aiq: 90, m: null, s: null }, gauges);
  approx(high.composite!, 90);
  approx(high.finalScore!, 85.5);
  assert.equal(high.tier, "High");
  assert.equal(high.macroGatesHit, 1);
  assert.equal(high.macroMultiplier, 0.95);

  // Borderline 78 (above 75) de-rates to 74.1, crosses into Medium.
  const borderline = computeComposite("Y", 1, { q: 78, g: 78, v: 78, aiq: 78, m: null, s: null }, gauges);
  approx(borderline.composite!, 78);
  approx(borderline.finalScore!, 78 * 0.95);
  assert.equal(borderline.tier, "Medium");
});

// THS-50 invariance: multiplier is only applied to composites ≥ 75; Medium/Low
// names see no de-rate so their tier is determined entirely by raw composite.
test("computeComposite: composite < 75 is never de-rated, even with gates hit", () => {
  const gauges: MacroGauges = { naaim: 96.67, aaii_3wk_spread: 5.36, fear_greed: 66 };
  const mid = computeComposite("Z", 1, { q: 70, g: 70, v: 70, aiq: 70, m: null, s: null }, gauges);
  approx(mid.composite!, 70);
  approx(mid.finalScore!, 70); // unchanged
  assert.equal(mid.tier, "Medium");
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

// ─── Concentration tax (THS-63 → composite wiring) ──────────────────────────

test("computeComposite: default tax=0 → composite_taxed === composite", () => {
  const scores: FactorScores = { q: 80, g: 70, v: 50, aiq: 60, m: null, s: null };
  const r = computeComposite("T", 1, scores, noGauges);
  approx(r.compositeTaxed!, r.composite!);
  assert.equal(r.concentrationTax, 0);
});

test("computeComposite: additive tax — pre-multiplier", () => {
  // High pre-tax composite, no macro gates → multiplier 1.0.
  // tax = -5 should subtract directly from composite_taxed and final_score.
  const scores: FactorScores = { q: 88, g: 95, v: 60, aiq: 87, m: null, s: null };
  const r = computeComposite("NVDA", 1, scores, noGauges, -5);
  approx(r.compositeTaxed!, r.composite! - 5);
  approx(r.finalScore!, r.composite! - 5); // multiplier=1.0
  assert.equal(r.concentrationTax, -5);
});

test("computeComposite: TSM spec arithmetic (composite + tax) × multiplier ≈ 82.2", () => {
  // Q=92 G=88 V=75 AIQ=92 at L1 weights (Tier-A rescale; M/S null).
  // Q=0.22 G=0.26 V=0.14 AIQ=0.18 → sum 0.80; rescaled:
  // 0.275, 0.325, 0.175, 0.225 → composite = 87.7.
  // tax = -1 → 86.7. Macro 1 gate → 0.95 → 82.4. Spec says 82.2 (within 0.5).
  const scores: FactorScores = { q: 92, g: 88, v: 75, aiq: 92, m: null, s: null };
  const oneGate: MacroGauges = { naaim: 96, aaii_3wk_spread: 0, fear_greed: 0 };
  const r = computeComposite("TSM", 1, scores, oneGate, -1);
  approx(r.composite!, 87.7, 0.5);
  approx(r.compositeTaxed!, 86.7, 0.5);
  approx(r.finalScore!, 82.4, 0.5);
  assert.equal(r.tier, "High");
});

test("computeComposite: NVDA spec arithmetic (composite -5) × 0.95 ≈ 75.7", () => {
  // Q=88 G=95 V=60 AIQ=87 at L1; composite ≈ 85.15. tax=-5 → 80.15.
  // × 0.95 → 76.14. Spec says 75.7 (within 0.5).
  const scores: FactorScores = { q: 88, g: 95, v: 60, aiq: 87, m: null, s: null };
  const oneGate: MacroGauges = { naaim: 96, aaii_3wk_spread: 0, fear_greed: 0 };
  const r = computeComposite("NVDA", 1, scores, oneGate, -5);
  approx(r.composite!, 85.15, 0.5);
  approx(r.compositeTaxed!, 80.15, 0.5);
  approx(r.finalScore!, 76.14, 0.5);
  assert.equal(r.tier, "High");
});

test("computeComposite: tax pushes composite below 75 → no macro de-rate, tier drops", () => {
  // Pre-tax composite ≈ 80. tax=-10 → 70 < 75. Multiplier does NOT apply.
  // Final = 70, tier = Medium even though macro had 1 gate.
  const scores: FactorScores = { q: 85, g: 85, v: 70, aiq: 80, m: null, s: null };
  const oneGate: MacroGauges = { naaim: 96, aaii_3wk_spread: 0, fear_greed: 0 };
  const r = computeComposite("X", 1, scores, oneGate, -10);
  assert.ok(r.composite! >= 75, "pre-tax composite expected >= 75");
  assert.ok(r.compositeTaxed! < 75, "taxed composite expected < 75");
  approx(r.finalScore!, r.compositeTaxed!, 1e-9); // no multiplier applied
  assert.equal(r.tier, "Medium");
});

test("computeComposite: tax cannot lift score above pre-tax threshold (negative-only domain)", () => {
  // Tax is in [-15, 0] by spec; positive values are non-physical. Verify
  // a positive tax still routes through, but document the expected use is
  // negative — the helper doesn't clamp (concentration.ts already caps).
  const scores: FactorScores = { q: 70, g: 70, v: 70, aiq: 70, m: null, s: null };
  const r = computeComposite("X", 1, scores, noGauges, 5);
  // We don't assert clamping — just that the value flows through unchanged.
  approx(r.compositeTaxed!, r.composite! + 5);
});

test("computeComposite: NaN tax treated as 0", () => {
  const scores: FactorScores = { q: 80, g: 70, v: 50, aiq: 60, m: null, s: null };
  const r = computeComposite("T", 1, scores, noGauges, Number.NaN);
  assert.equal(r.concentrationTax, 0);
  approx(r.compositeTaxed!, r.composite!);
});

test("computeComposite: every factor null + tax → composite null, tax preserved", () => {
  const scores: FactorScores = { q: null, g: null, v: null, aiq: null, m: null, s: null };
  const r = computeComposite("T", 1, scores, noGauges, -3);
  assert.equal(r.composite, null);
  assert.equal(r.compositeTaxed, null);
  assert.equal(r.finalScore, null);
  assert.equal(r.concentrationTax, -3);
});

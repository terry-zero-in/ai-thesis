// THS-45 — Composite score: per-layer weighted combination of Q/G/V/AIQ
// (and later M/S), macro-gate de-rating, tier classification.
//
// Spec: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §compute_composite,
//       §Fix 2 (weight table), §Fix 4 (Bayesian macro gate), §Part 3.
//
// Pure, no DB — the orchestrator edge function passes per-ticker scores
// + the macro gauges in and consumes the structured result.

import type { Layer } from "./factor-q.ts";
export type { Layer };

// ─── Layer weights (§Part 3) ───────────────────────────────────────────────
//
// Each row sums to 1.0. M and S enter the composite once the engine is
// live; until then they're null and we rescale Q+G+V+AIQ to sum to 1.0.

export interface FullWeights {
  Q: number;
  G: number;
  V: number;
  AIQ: number;
  M: number;
  S: number;
}

export const LAYER_WEIGHTS: Record<Layer, FullWeights> = {
  1: { Q: 0.22, G: 0.26, V: 0.14, AIQ: 0.18, M: 0.12, S: 0.08 },
  2: { Q: 0.32, G: 0.22, V: 0.14, AIQ: 0.14, M: 0.10, S: 0.08 },
  3: { Q: 0.18, G: 0.30, V: 0.08, AIQ: 0.18, M: 0.16, S: 0.10 },
  4: { Q: 0.30, G: 0.22, V: 0.18, AIQ: 0.14, M: 0.10, S: 0.06 },
  5: { Q: 0.28, G: 0.18, V: 0.16, AIQ: 0.14, M: 0.14, S: 0.10 },
};

// ─── Scores in / Composite out ──────────────────────────────────────────────

export interface FactorScores {
  q: number | null;
  g: number | null;
  v: number | null;
  aiq: number | null;
  m: number | null;       // null until Tier-B (Epic 5) ships
  s: number | null;       // null until Tier-B (Epic 5) ships
}

export interface MacroGauges {
  naaim: number | null;
  aaii_3wk_spread: number | null;
  fear_greed: number | null;
}

export type Tier = "High" | "Medium" | "Low" | "Avoid";

export interface CompositeResult {
  ticker: string;
  layer: Layer;
  // Pre-multiplier composite (weighted average of available factors).
  composite: number | null;
  // After macro multiplier — multiplier applies only to composites ≥ 75.
  finalScore: number | null;
  tier: Tier | null;
  macroGatesHit: number;
  macroMultiplier: number;
  resolvedWeights: Record<string, number>;  // the rescaled / clamped weights
                                              // actually used, for audit
}

// ─── Macro gate (§Fix 4) ────────────────────────────────────────────────────

const MACRO_MULTIPLIER_BY_GATES: Record<number, number> = {
  0: 1.00,
  1: 0.95,
  2: 0.90,
  3: 0.85,
};

export function countMacroGates(g: MacroGauges): number {
  let hits = 0;
  if (typeof g.naaim === "number" && Number.isFinite(g.naaim) && g.naaim > 90) hits += 1;
  if (typeof g.aaii_3wk_spread === "number" && Number.isFinite(g.aaii_3wk_spread) && g.aaii_3wk_spread > 30) hits += 1;
  if (typeof g.fear_greed === "number" && Number.isFinite(g.fear_greed) && g.fear_greed > 80) hits += 1;
  return hits;
}

export function macroMultiplier(g: MacroGauges): { multiplier: number; gatesHit: number } {
  const gatesHit = countMacroGates(g);
  return { multiplier: MACRO_MULTIPLIER_BY_GATES[gatesHit] ?? 1.0, gatesHit };
}

// ─── Tier classifier (§compute_composite cut-points) ────────────────────────

export function classifyTier(score: number | null): Tier | null {
  if (score === null || !Number.isFinite(score)) return null;
  if (score >= 75) return "High";
  if (score >= 60) return "Medium";
  if (score >= 45) return "Low";
  return "Avoid";
}

// ─── Weight resolution (Tier-A rescale) ─────────────────────────────────────
//
// Spec rule: if M or S is null, rescale Q+G+V+AIQ to sum to 1.0 by dividing
// each by the sum of available Tier-A weights. We extend the rule one step:
// any factor that comes back null for THIS ticker gets dropped from the
// weighted average and the remaining weights rescale among themselves.
// This matches the cohort-aggregation policy in factor-q/g/v (missing
// signals don't drag the composite toward zero or the cohort mean).

interface ResolvedFactor {
  key: keyof FactorScores;
  value: number;
  weight: number;
}

function resolveWeights(scores: FactorScores, layer: Layer): ResolvedFactor[] {
  const w = LAYER_WEIGHTS[layer];
  const candidates: Array<{ key: keyof FactorScores; weight: number }> = [
    { key: "q", weight: w.Q },
    { key: "g", weight: w.G },
    { key: "v", weight: w.V },
    { key: "aiq", weight: w.AIQ },
    { key: "m", weight: w.M },
    { key: "s", weight: w.S },
  ];
  const available = candidates.filter((c) => {
    const v = scores[c.key];
    return typeof v === "number" && Number.isFinite(v);
  });
  if (available.length === 0) return [];
  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return []; // pathological: every available factor has 0 weight
  return available.map((c) => ({
    key: c.key,
    value: scores[c.key] as number,
    weight: c.weight / totalWeight,
  }));
}

// ─── Main entry point ───────────────────────────────────────────────────────

export function computeComposite(
  ticker: string,
  layer: Layer,
  scores: FactorScores,
  gauges: MacroGauges,
): CompositeResult {
  const resolved = resolveWeights(scores, layer);
  const macro = macroMultiplier(gauges);

  if (resolved.length === 0) {
    return {
      ticker, layer,
      composite: null,
      finalScore: null,
      tier: null,
      macroGatesHit: macro.gatesHit,
      macroMultiplier: macro.multiplier,
      resolvedWeights: {},
    };
  }

  let composite = 0;
  for (const r of resolved) composite += r.weight * r.value;

  // Macro multiplier de-rates High names only (spec: "only de-rate High").
  // Apply to the unrounded composite so the High/Medium boundary respects
  // the de-rating; a 75.4 → 0.95 → 71.6 result correctly drops to Medium.
  const finalScore = composite >= 75 ? composite * macro.multiplier : composite;
  const tier = classifyTier(finalScore);

  const resolvedWeights = Object.fromEntries(resolved.map((r) => [r.key, r.weight]));
  return {
    ticker, layer,
    composite,
    finalScore,
    tier,
    macroGatesHit: macro.gatesHit,
    macroMultiplier: macro.multiplier,
    resolvedWeights,
  };
}

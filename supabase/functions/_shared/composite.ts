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
  // Pre-tax, pre-multiplier composite (weighted average of available factors).
  composite: number | null;
  // Concentration tax applied (negative, in [-15, 0]). 0 when no tax row exists.
  concentrationTax: number;
  // composite + concentrationTax. The macro multiplier threshold (≥ 75)
  // tests against this taxed value, per spec arithmetic.
  compositeTaxed: number | null;
  // After macro multiplier — multiplier applies only to taxed composites ≥ 75.
  // Also reflects the sentiment cap at 55 when both quartile conditions
  // are met (see SENTIMENT_CAP_MAX).
  finalScore: number | null;
  tier: Tier | null;
  macroGatesHit: number;
  macroMultiplier: number;
  // True when the bottom-Q-quartile + top-S-quartile cap was applied
  // (spec line 119). Always false until S goes live in Epic 5.
  sentimentCapApplied: boolean;
  resolvedWeights: Record<string, number>;  // the rescaled / clamped weights
                                              // actually used, for audit
}

// ─── Sentiment cap (§spec line 119) ─────────────────────────────────────────
//
// A name in bottom-quartile Q AND top-quartile S is capped at score = 55.
// Applied AFTER composite + tax + macro multiplier, before tier assignment.
// Tier classification reads off the capped number, so by construction a
// capped name lands in Medium (60-74) or Low (45-59) — it can't be High.
//
// Caller is responsible for computing the per-ticker quartile flags by
// ranking the current universe snapshot's Q and S distributions and
// passing them in. See computeSentimentCapFlags() below.
//
// Expected hit rate in steady state: ~0-3 names out of ~70 — by design.
// The cap is a guardrail against 2021-style sentiment-driven rallies of
// bad-quality names, NOT a filter. If it never fires for several weeks,
// that's the engine working — don't conclude the cap is broken.
//
// Until S is live (Epic 5), `sTopQuartile` is always false → cap is a
// no-op. Ship-it-now, no-op-until-S-lands keeps the regression surface
// covered the day S goes online.

export const SENTIMENT_CAP_MAX = 55;
export const SENTIMENT_CAP_Q_PERCENTILE = 0.25;
export const SENTIMENT_CAP_S_PERCENTILE = 0.75;

export interface SentimentCapFlags {
  /** True when this ticker's Q is in the universe's bottom quartile. */
  qBottomQuartile: boolean;
  /** True when this ticker's S is in the universe's top quartile. */
  sTopQuartile: boolean;
}

/**
 * Given a universe snapshot of per-ticker Q + S scores, derive each
 * ticker's quartile flags. Returns an empty Map when there aren't
 * enough names to define a quartile (< 4 with non-null scores for
 * either factor).
 *
 * Both factor distributions are evaluated independently — a ticker
 * with null Q gets `qBottomQuartile=false` (can't trigger the cap)
 * and the same for S.
 */
export function computeSentimentCapFlags(
  universe: Array<{ ticker: string; q: number | null; s: number | null }>,
): Map<string, SentimentCapFlags> {
  const out = new Map<string, SentimentCapFlags>();
  const qVals = universe.map((u) => u.q).filter((v): v is number => v != null && Number.isFinite(v));
  const sVals = universe.map((u) => u.s).filter((v): v is number => v != null && Number.isFinite(v));
  // Need at least 4 names per distribution to define a quartile boundary.
  const qThresh = qVals.length >= 4 ? percentile(qVals, SENTIMENT_CAP_Q_PERCENTILE) : null;
  const sThresh = sVals.length >= 4 ? percentile(sVals, SENTIMENT_CAP_S_PERCENTILE) : null;
  for (const u of universe) {
    out.set(u.ticker, {
      qBottomQuartile: qThresh != null && u.q != null && Number.isFinite(u.q) && u.q <= qThresh,
      sTopQuartile:    sThresh != null && u.s != null && Number.isFinite(u.s) && u.s >= sThresh,
    });
  }
  return out;
}

/** Linear-interpolated quantile (type-7 / Excel-style). */
function percentile(sorted: number[], p: number): number {
  const arr = sorted.slice().sort((a, b) => a - b);
  if (arr.length === 0) return NaN;
  if (arr.length === 1) return arr[0];
  const idx = (arr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return arr[lo];
  return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
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
  concentrationTax: number = 0,
  sentimentCap?: SentimentCapFlags,
): CompositeResult {
  const resolved = resolveWeights(scores, layer);
  const macro = macroMultiplier(gauges);
  const tax = Number.isFinite(concentrationTax) ? concentrationTax : 0;

  if (resolved.length === 0) {
    return {
      ticker, layer,
      composite: null,
      concentrationTax: tax,
      compositeTaxed: null,
      finalScore: null,
      tier: null,
      macroGatesHit: macro.gatesHit,
      macroMultiplier: macro.multiplier,
      sentimentCapApplied: false,
      resolvedWeights: {},
    };
  }

  let composite = 0;
  for (const r of resolved) composite += r.weight * r.value;

  // Concentration tax is additive, applied BEFORE the macro multiplier
  // (spec arithmetic — see docs/AI-Thesis-v2-Algorithm-and-Deployment.md
  // worked examples for TSM 82.2 / NVDA 75.7). The macro multiplier
  // "only de-rate High" threshold tests against the taxed value, not the
  // raw composite: a name with composite=80 / tax=-10 → 70 → no de-rate,
  // because at 70 it's already Medium.
  const compositeTaxed = composite + tax;
  let finalScore = compositeTaxed >= 75 ? compositeTaxed * macro.multiplier : compositeTaxed;

  // Sentiment cap (spec line 119). Applied LAST, before tier assignment.
  // No-op until S goes live (Epic 5) — `sTopQuartile` is always false
  // for a null S, so the cap is unfireable by definition.
  const sentimentCapApplied =
    sentimentCap != null &&
    sentimentCap.qBottomQuartile &&
    sentimentCap.sTopQuartile &&
    finalScore > SENTIMENT_CAP_MAX;
  if (sentimentCapApplied) finalScore = SENTIMENT_CAP_MAX;

  const tier = classifyTier(finalScore);

  const resolvedWeights = Object.fromEntries(resolved.map((r) => [r.key, r.weight]));
  return {
    ticker, layer,
    composite,
    concentrationTax: tax,
    compositeTaxed,
    finalScore,
    tier,
    macroGatesHit: macro.gatesHit,
    macroMultiplier: macro.multiplier,
    sentimentCapApplied,
    resolvedWeights,
  };
}

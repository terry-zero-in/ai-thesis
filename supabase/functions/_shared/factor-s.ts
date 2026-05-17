// THS-62 (E5.5) — S-score: sentiment composite.
//
// Spec: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §Fix 4
//
//   30% sell-side revision delta  (FY1 EPS 30d % change from `revisions`)
//   25% options skew (25Δ P-C vs 90d avg)  — BLOCKED on THS-59 options
//                                            ingestion; null until then
//   20% SUSI                       (z-score of latest SI vs 24mo baseline)
//   25% insider asymmetric override (cluster detection from Form 4)
//
// "NO LLM-pulse" per spec.
//
// Cross-sectional like M: scored against the full investable cohort.
// Partial coverage rescales the available weights so a ticker missing
// options data still scores cleanly on the other three signals.

import { percentileRankInCohort, zScoreInCohort } from "./stats.ts";

export type Layer = 1 | 2 | 3 | 4 | 5;

export interface SInputs {
  ticker: string;
  layer: Layer;
  /** FY1 EPS 30-day percent change (decimal, e.g. +0.03 = +3%). */
  revisions_delta: number | null;
  /** 25Δ put-call skew vs 90d average. null until THS-59 ships. */
  options_skew: number | null;
  /** Time-series z-score of latest short interest vs 24mo baseline. */
  susi_z: number | null;
  /** Insider asymmetric override: +5 (BUY cluster), -3 (SELL cluster), 0 (neither). */
  insider_override: number | null;
}

export interface SSignals {
  revisions_delta: number | null;
  options_skew: number | null;
  susi_z: number | null;
  insider_override: number | null;
}

export interface SResult {
  ticker: string;
  layer: Layer;
  sScore: number | null;
  compositeZ: number | null;
  signals: SSignals;
}

// Spec weights.
const W_REV = 0.30;
const W_SKEW = 0.25;
const W_SUSI = 0.20;
const W_INSIDER = 0.25;

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function nanForNull(v: number | null): number {
  return v === null ? NaN : v;
}

/**
 * Compute S-scores for the cohort.
 *
 * Signal direction notes:
 *   - revisions_delta: positive = upward revisions = bullish
 *   - options_skew:    positive = puts richer than calls = bearish; we
 *                      NEGATE so higher means more bullish (matches the
 *                      other signals' direction convention)
 *   - susi_z:          positive = elevated short interest = bearish; we
 *                      NEGATE so higher = bullish
 *   - insider_override: +5/0/-3 already in bullish-higher direction
 */
export function computeSForCohort(inputs: ReadonlyArray<SInputs>): SResult[] {
  if (inputs.length === 0) return [];

  const cohortRev = inputs.map((i) => nanForNull(i.revisions_delta));
  // Negate skew + SUSI so cohort z-scoring lands "bullish = high".
  const cohortSkew = inputs.map((i) => (i.options_skew === null ? NaN : -i.options_skew));
  const cohortSusi = inputs.map((i) => (i.susi_z === null ? NaN : -i.susi_z));
  const cohortInsider = inputs.map((i) => nanForNull(i.insider_override));

  const weightedZs: number[] = inputs.map((i) => {
    const parts: Array<{ w: number; z: number }> = [];
    if (isFiniteNumber(i.revisions_delta)) parts.push({ w: W_REV, z: zScoreInCohort(i.revisions_delta, cohortRev) });
    if (isFiniteNumber(i.options_skew)) parts.push({ w: W_SKEW, z: zScoreInCohort(-i.options_skew, cohortSkew) });
    if (isFiniteNumber(i.susi_z)) parts.push({ w: W_SUSI, z: zScoreInCohort(-i.susi_z, cohortSusi) });
    if (isFiniteNumber(i.insider_override)) parts.push({ w: W_INSIDER, z: zScoreInCohort(i.insider_override, cohortInsider) });
    if (parts.length === 0) return NaN;
    const totalW = parts.reduce((s, p) => s + p.w, 0);
    return parts.reduce((s, p) => s + (p.w / totalW) * p.z, 0);
  });

  return inputs.map((i, ix) => {
    const z = weightedZs[ix];
    const score = Number.isFinite(z) ? percentileRankInCohort(z, weightedZs) : null;
    return {
      ticker: i.ticker,
      layer: i.layer,
      sScore: score === null || Number.isNaN(score) ? null : Math.round(score * 10) / 10,
      compositeZ: Number.isFinite(z) ? Math.round(z * 1000) / 1000 : null,
      signals: {
        revisions_delta: i.revisions_delta,
        options_skew: i.options_skew,
        susi_z: i.susi_z,
        insider_override: i.insider_override,
      },
    };
  });
}

export const S_WEIGHTS = {
  revisions_delta: W_REV,
  options_skew: W_SKEW,
  susi_z: W_SUSI,
  insider_override: W_INSIDER,
};

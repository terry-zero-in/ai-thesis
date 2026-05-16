// THS-58 (E5.1) — M-score: 12-1 momentum + SUE + revision breadth.
//
// Spec: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §Fix 2
//   v2 momentum sub-weights: 25% price 12-1 / 40% SUE / 35% revision breadth.
//
// Layer-agnostic — momentum is a cross-sectional signal computed over the
// full investable cohort, not per layer. (Q/G/V are within-layer because
// hyperscalers shouldn't be compared to compute on profitability; momentum
// is. We still z-score within the cohort assembled by the caller, so the
// orchestrator can pass the whole investable universe in as one call.)
//
// SUE simplification (v1 deviation, documented):
//   Classic SUE = (actual - expected) / stdev(expected). FMP doesn't expose
//   analyst stdev for the EPS surprise window, and our `consensus` schema
//   currently doesn't carry it. v1 uses the percentage-surprise proxy:
//     surprise = (actual - expected) / max(0.01, |expected|)
//   then z-scores the surprise across the cohort. When stdev ingestion
//   lands (consensus schema-expand), swap the denominator in computeSue()
//   and the unit test will catch any regression.

import { percentileRankInCohort, zScoreInCohort } from "./stats.ts";

export type Layer = 1 | 2 | 3 | 4 | 5;

export interface MInputs {
  ticker: string;
  layer: Layer;
  /** Close approximately 13 months before as_of (start of the 12-1 window). */
  close_13mo: number | null;
  /** Close approximately 1 month before as_of (end of the 12-1 window). */
  close_1mo: number | null;
  /**
   * Actual EPS from the latest reported quarter (net_income / shares_diluted).
   * null when the report or any of its constituent fields are missing.
   */
  actual_eps_latest: number | null;
  /**
   * Consensus FY1 EPS from the snapshot immediately preceding the latest
   * report's period_end. Acts as "expected EPS at the time of report."
   */
  expected_eps_at_report: number | null;
  /** 30-day upward-revision breadth (% of analysts revising up), 0..100. */
  upward_breadth_pct: number | null;
}

export interface MSignals {
  /** Price 12-1 total return (decimal, e.g. 0.34 = +34%). */
  price12_1: number | null;
  /** Earnings surprise percentage (decimal). */
  sue: number | null;
  /** Upward revision breadth (decimal, 0..1 — scaled from the 0..100 column). */
  revBreadth: number | null;
}

export interface MResult {
  ticker: string;
  layer: Layer;
  mScore: number | null;
  compositeZ: number | null;
  signals: MSignals;
}

// ─── Signal computations ────────────────────────────────────────────────────

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function nanForNull(v: number | null): number {
  return v === null ? NaN : v;
}

/**
 * Price 12-1 total return. Excludes the most recent month per the long-
 * standing momentum-anomaly convention (Jegadeesh-Titman 1993 et seq) —
 * the most-recent-month reversal effect drags pure-12 momentum down.
 */
export function price12_1(inp: MInputs): number | null {
  if (!isFiniteNumber(inp.close_13mo) || inp.close_13mo <= 0) return null;
  if (!isFiniteNumber(inp.close_1mo) || inp.close_1mo <= 0) return null;
  return (inp.close_1mo - inp.close_13mo) / inp.close_13mo;
}

/**
 * SUE (v1 proxy) — percentage surprise on the latest quarterly EPS.
 * Returns null when either side is missing. Floor on |expected| keeps a
 * tiny denominator from blowing the score up; the 0.01 floor corresponds
 * to ~1¢ EPS, which is below the practical signal threshold.
 */
export function computeSue(inp: MInputs): number | null {
  if (!isFiniteNumber(inp.actual_eps_latest)) return null;
  if (!isFiniteNumber(inp.expected_eps_at_report)) return null;
  const denom = Math.max(0.01, Math.abs(inp.expected_eps_at_report));
  return (inp.actual_eps_latest - inp.expected_eps_at_report) / denom;
}

/**
 * Upward-revision breadth, scaled from the 0..100 column to 0..1 so all
 * three signals live on roughly the same magnitude domain before z-scoring.
 * (z-scoring is scale-invariant in principle, but matching ranges keeps
 * the unscaled audit numbers in the breakdown more readable.)
 */
export function revisionBreadth(inp: MInputs): number | null {
  if (!isFiniteNumber(inp.upward_breadth_pct)) return null;
  return inp.upward_breadth_pct / 100;
}

// ─── Cohort scoring ─────────────────────────────────────────────────────────

const W_PRICE = 0.25;
const W_SUE = 0.40;
const W_BREADTH = 0.35;

/**
 * Compute M-scores for the cohort.
 *
 * Each signal is z-scored within the cohort, then weighted (0.25/0.40/0.35).
 * Tickers with all three signals missing return mScore=null (no fake zero).
 * Tickers with partial coverage rescale the available weights so a name with
 * only price + breadth gets credit for both rather than being dragged toward
 * the neutral mean by a missing SUE.
 */
export function computeMForCohort(inputs: ReadonlyArray<MInputs>): MResult[] {
  if (inputs.length === 0) return [];

  const derived = inputs.map((inp) => ({
    ticker: inp.ticker,
    layer: inp.layer,
    price12_1: price12_1(inp),
    sue: computeSue(inp),
    revBreadth: revisionBreadth(inp),
  }));

  const cohortPrice = derived.map((d) => nanForNull(d.price12_1));
  const cohortSue = derived.map((d) => nanForNull(d.sue));
  const cohortBreadth = derived.map((d) => nanForNull(d.revBreadth));

  const weightedZs: number[] = derived.map((d) => {
    const parts: Array<{ w: number; z: number }> = [];
    if (isFiniteNumber(d.price12_1)) parts.push({ w: W_PRICE, z: zScoreInCohort(d.price12_1, cohortPrice) });
    if (isFiniteNumber(d.sue)) parts.push({ w: W_SUE, z: zScoreInCohort(d.sue, cohortSue) });
    if (isFiniteNumber(d.revBreadth)) parts.push({ w: W_BREADTH, z: zScoreInCohort(d.revBreadth, cohortBreadth) });
    if (parts.length === 0) return NaN;
    const totalW = parts.reduce((s, p) => s + p.w, 0);
    return parts.reduce((s, p) => s + (p.w / totalW) * p.z, 0);
  });

  return derived.map((d, i) => {
    const z = weightedZs[i];
    const mScore = Number.isFinite(z) ? percentileRankInCohort(z, weightedZs) : null;
    return {
      ticker: d.ticker,
      layer: d.layer,
      mScore: mScore === null || Number.isNaN(mScore) ? null : Math.round(mScore * 10) / 10,
      compositeZ: Number.isFinite(z) ? Math.round(z * 1000) / 1000 : null,
      signals: {
        price12_1: d.price12_1,
        sue: d.sue,
        revBreadth: d.revBreadth,
      },
    };
  });
}

export const M_WEIGHTS = { price12_1: W_PRICE, sue: W_SUE, revBreadth: W_BREADTH };

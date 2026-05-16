// THS-63 (E6.1) — Concentration tax.
//
// Spec: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §Section F (v1 spec
// transcribed): three concentration signals combine into a per-ticker
// tax in [-15, 0]:
//
//   1. Mean pairwise correlation to the rest of the universe (120-day
//      window). High = name moves with the herd → more concentrated risk.
//
//   2. PC1 loading magnitude from PCA on the universe returns matrix.
//      High = name dominates the leading source of universe variance →
//      more concentrated risk.
//
//   3. Supply-chain dependency degree — count of curated edges in the
//      dependency map, both inbound (X is a supplier) and outbound (X
//      depends on suppliers). High = name sits at a critical node.
//
// All three are ranked across the universe to [0,1] (0=least, 1=most
// concentrated). Final tax = -15 * weighted_average(ranks). The 0..1
// rank normalization is what makes the tax robust to absolute scales —
// it's the *relative* concentration that matters.
//
// Calibration target (acceptance criterion): NVDA ≈ -5, TSM ≈ -1.
//
// Pure module — no DB / SDK imports.

import { percentileRankInCohort } from "./stats.ts";

export const TAX_CAP = -15;

/** Default weights — corr & pc1 dominate; supply chain is a tilt. */
export const TAX_WEIGHTS = { correlation: 0.4, pc1: 0.4, supply_chain: 0.2 };

export interface ConcentrationInputs {
  /** Map ticker → daily return series in the 120-day window. */
  returns: Map<string, number[]>;
  /** Curated dependency edges: ticker -> set of related-ticker names. */
  supplyChainDegree: Map<string, number>;
}

export interface ConcentrationResult {
  ticker: string;
  tax: number; // in [TAX_CAP, 0]
  signals: {
    mean_corr: number | null;
    pc1_loading_abs: number | null;
    supply_chain_degree: number;
    corr_rank: number;       // 0..100 percentile
    pc1_rank: number;        // 0..100
    supply_rank: number;     // 0..100
  };
}

export function computeConcentrationTax(inputs: ConcentrationInputs): ConcentrationResult[] {
  const tickers = Array.from(inputs.returns.keys()).sort();
  if (tickers.length < 2) {
    return tickers.map((t) => emptyResult(t, inputs.supplyChainDegree.get(t) ?? 0));
  }

  // Truncate all series to the same length (the shortest).
  const minLen = Math.min(...tickers.map((t) => inputs.returns.get(t)!.length));
  if (minLen < 30) {
    // Not enough overlap — emit zero tax for all.
    return tickers.map((t) => emptyResult(t, inputs.supplyChainDegree.get(t) ?? 0));
  }
  const aligned = tickers.map((t) => inputs.returns.get(t)!.slice(-minLen));

  const meanCorr = meanPairwiseCorrelation(tickers, aligned);
  const pc1 = pc1LoadingsAbs(tickers, aligned);

  // Build cohort arrays for percentile-rank.
  const corrCohort = tickers.map((t) => meanCorr.get(t) ?? NaN);
  const pc1Cohort = tickers.map((t) => pc1.get(t) ?? NaN);
  const supplyCohort = tickers.map((t) => inputs.supplyChainDegree.get(t) ?? 0);

  return tickers.map((t) => {
    const mc = meanCorr.get(t);
    const pl = pc1.get(t);
    const sd = inputs.supplyChainDegree.get(t) ?? 0;
    const corrRank = mc == null ? 0 : percentileRankInCohort(mc, corrCohort);
    const pc1Rank = pl == null ? 0 : percentileRankInCohort(pl, pc1Cohort);
    const supplyRank = percentileRankInCohort(sd, supplyCohort);
    const blended =
      TAX_WEIGHTS.correlation * corrRank +
      TAX_WEIGHTS.pc1 * pc1Rank +
      TAX_WEIGHTS.supply_chain * supplyRank;
    // blended is 0..100 (since each rank is 0..100). Scale to [-15, 0].
    const tax = (blended / 100) * TAX_CAP;
    return {
      ticker: t,
      tax: Math.round(tax * 10) / 10,
      signals: {
        mean_corr: mc ?? null,
        pc1_loading_abs: pl ?? null,
        supply_chain_degree: sd,
        corr_rank: Math.round(corrRank * 10) / 10,
        pc1_rank: Math.round(pc1Rank * 10) / 10,
        supply_rank: Math.round(supplyRank * 10) / 10,
      },
    };
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function emptyResult(ticker: string, supplyDeg: number): ConcentrationResult {
  return {
    ticker,
    tax: 0,
    signals: {
      mean_corr: null,
      pc1_loading_abs: null,
      supply_chain_degree: supplyDeg,
      corr_rank: 0,
      pc1_rank: 0,
      supply_rank: 0,
    },
  };
}

function meanForArr(xs: ReadonlyArray<number>): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function pearsonCorrelation(xs: ReadonlyArray<number>, ys: ReadonlyArray<number>): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = meanForArr(xs.slice(0, n));
  const my = meanForArr(ys.slice(0, n));
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

/** Mean pairwise Pearson correlation excluding self. */
export function meanPairwiseCorrelation(
  tickers: ReadonlyArray<string>,
  returns: ReadonlyArray<ReadonlyArray<number>>,
): Map<string, number> {
  const out = new Map<string, number>();
  const n = tickers.length;
  // Precompute the full correlation matrix once.
  const cm: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    cm[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const c = pearsonCorrelation(returns[i], returns[j]);
      cm[i][j] = c;
      cm[j][i] = c;
    }
  }
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      s += cm[i][j];
    }
    out.set(tickers[i], s / (n - 1));
  }
  return out;
}

/**
 * PC1 loadings via power iteration on the covariance matrix. Returns
 * absolute values per ticker; sign is irrelevant for concentration.
 */
export function pc1LoadingsAbs(
  tickers: ReadonlyArray<string>,
  returns: ReadonlyArray<ReadonlyArray<number>>,
): Map<string, number> {
  const n = tickers.length;
  if (n < 2) return new Map(tickers.map((t) => [t, 0]));

  // Build centered returns matrix (n × T).
  const T = returns[0].length;
  const centered: number[][] = returns.map((row) => {
    const m = meanForArr(row);
    return row.map((v) => v - m);
  });

  // Covariance matrix (n × n): C[i][j] = (1/(T-1)) * sum_k centered[i][k] * centered[j][k]
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0;
      for (let k = 0; k < T; k++) s += centered[i][k] * centered[j][k];
      const v = s / Math.max(1, T - 1);
      cov[i][j] = v;
      cov[j][i] = v;
    }
  }

  // Power iteration: start with uniform vector, multiply by cov repeatedly,
  // normalize, iterate until convergence or 200 iterations.
  let v: number[] = new Array(n).fill(1 / Math.sqrt(n));
  for (let iter = 0; iter < 200; iter++) {
    const next: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += cov[i][j] * v[j];
      next[i] = s;
    }
    const norm = Math.sqrt(next.reduce((s, x) => s + x * x, 0));
    if (norm === 0) break;
    const normalized = next.map((x) => x / norm);
    // Convergence check: max abs change.
    let maxDiff = 0;
    for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(normalized[i] - v[i]));
    v = normalized;
    if (maxDiff < 1e-8) break;
  }

  return new Map(tickers.map((t, i) => [t, Math.abs(v[i])]));
}

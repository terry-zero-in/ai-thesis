// THS-41 — Q-score: AQR QMJ adapted for the AI Thesis universe.
//
// Spec: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §compute_q_score.
// Implementation strategy:
//   1. Caller assembles a `QInputs` per ticker (raw fundamentals + market cap
//      + return series + EPS history + 5y annual history) for every name in
//      the layer cohort.
//   2. For each pillar we (a) compute the per-ticker primitive metrics,
//      (b) z-score each metric within the layer cohort, (c) average the
//      z-scores into a pillar z-score per ticker.
//   3. Combine pillar z-scores with payout-downweighted weights (L1–L3 get
//      payout × 0.5; the freed weight redistributes equally to the other
//      three pillars), then map composite-z to 0..100 via empirical
//      percentile rank within the cohort.
//
// Open question flagged in the spec: the safety pillar pseudocode reads
// `-altman_z_score(...)`. Negating altman_z makes the pillar treat HIGH
// Altman Z (safer) as a LOWER safety contribution — which inverts the
// pillar's intent and contradicts the sign convention of the other three
// safety components (where negation flips a "high=risky" metric into
// "high=safe"). We feed +altman_z into the safety pillar and document the
// deviation here. If Terry wants strict pseudocode, flip the sign on
// `SAFETY_METRIC_KEYS["altmanZ"]`.

import {
  altmanZ,
  beta,
  effectiveTaxRate,
  epsVolatility,
  fcfOverRevenue,
  fiveYearDelta,
  grossProfitOverAssets,
  leverage,
  operatingMargin,
  payoutYield,
  roic,
  type Fundamentals,
} from "./metrics.ts";
import {
  percentileRankInCohort,
  zScoreInCohort,
} from "./stats.ts";

export type Layer = 1 | 2 | 3 | 4 | 5;

/**
 * Inputs the Q-score needs for a single ticker. Build one per ticker in the
 * layer cohort; pass the full array of cohort inputs to `computeQForCohort`.
 *
 * - `current` is the latest quarterly fundamentals row for ratios.
 * - `annuals` is the trailing 5y annual history (oldest first) used for
 *   the growth pillar's 5y deltas of profitability ratios.
 * - `quarterlyHistory` is the trailing N quarters (typically 20 = 5y) used
 *   to compute EPS volatility. Each row needs net_income + shares_diluted.
 * - `returns` carries pre-aligned daily own + benchmark returns for beta.
 * - `marketCap` is shares_diluted × current price.
 */
export interface QInputs {
  ticker: string;
  layer: Layer;
  current: Fundamentals;
  annuals: ReadonlyArray<Fundamentals>;
  quarterlyHistory: ReadonlyArray<Pick<Fundamentals, "net_income" | "shares_diluted">>;
  returns: { own: ReadonlyArray<number | null>; benchmark: ReadonlyArray<number | null> };
  marketCap: number | null;
}

export interface QPillars {
  profitability: number | null;
  growth: number | null;
  safety: number | null;
  payout: number | null;
}

export interface QResult {
  ticker: string;
  layer: Layer;
  qScore: number | null;       // 0..100, or null if can't compute (e.g. single-ticker cohort with all-NaN inputs)
  compositeZ: number | null;
  pillars: QPillars;
  // For UI / debugging: the raw primitive metrics that went in.
  metrics: {
    gpOverAssets: number | null;
    roic: number | null;
    fcfOverRevenue: number | null;
    operatingMargin: number | null;
    leverage: number | null;
    altmanZ: number | null;
    epsVolatility: number | null;
    beta: number | null;
    payoutYield: number | null;
    effectiveTaxRate: number | null;
    gpOverAssets_5y_delta: number | null;
    roic_5y_delta: number | null;
    fcfOverRevenue_5y_delta: number | null;
    operatingMargin_5y_delta: number | null;
  };
}

// Pillar weight rule: L1-L3 (Compute, Hyperscaler, App) get half the payout
// weight; the freed weight redistributes equally to the other three pillars.
function pillarWeights(layer: Layer): {
  profitability: number;
  growth: number;
  safety: number;
  payout: number;
} {
  const payout = layer === 1 || layer === 2 || layer === 3 ? 0.125 : 0.25;
  const other = (1.0 - payout) / 3;
  return { profitability: other, growth: other, safety: other, payout };
}

// ─── Per-ticker primitive derivation ─────────────────────────────────────────

interface DerivedMetrics {
  // Profitability components.
  gpTa: number | null;
  roic: number | null;
  fcfRev: number | null;
  opMargin: number | null;
  // 5y deltas of the four profitability components.
  gpTa_5y: number | null;
  roic_5y: number | null;
  fcfRev_5y: number | null;
  opMargin_5y: number | null;
  // Safety components (raw, pre-negation).
  beta: number | null;
  leverage: number | null;
  epsVol: number | null;
  altmanZ: number | null;
  // Payout.
  payoutYield: number | null;
  // Diagnostic.
  effectiveTaxRate: number | null;
}

function derive(input: QInputs): DerivedMetrics {
  const gpTa = grossProfitOverAssets(input.current);
  const r = roic(input.current);
  const fcfRev = fcfOverRevenue(input.current);
  const opMargin = operatingMargin(input.current);

  // 5y deltas: build per-annual series of each ratio, then delta the endpoints.
  const annualGpTa = input.annuals.map((a) => grossProfitOverAssets(a));
  const annualRoic = input.annuals.map((a) => roic(a));
  const annualFcfRev = input.annuals.map((a) => fcfOverRevenue(a));
  const annualOpMargin = input.annuals.map((a) => operatingMargin(a));

  const epsSeries = input.quarterlyHistory.map((q) =>
    q.net_income != null && q.shares_diluted != null && q.shares_diluted !== 0
      ? q.net_income / q.shares_diluted
      : null,
  );

  return {
    gpTa,
    roic: r,
    fcfRev,
    opMargin,
    gpTa_5y: fiveYearDelta(annualGpTa),
    roic_5y: fiveYearDelta(annualRoic),
    fcfRev_5y: fiveYearDelta(annualFcfRev),
    opMargin_5y: fiveYearDelta(annualOpMargin),
    beta: beta(input.returns.own, input.returns.benchmark),
    leverage: leverage(input.current),
    epsVol: epsVolatility(epsSeries),
    altmanZ: altmanZ(input.current, input.marketCap),
    payoutYield: payoutYield(input.current, input.marketCap),
    effectiveTaxRate: effectiveTaxRate(input.current),
  };
}

// ─── Pillar z-score: average of per-metric z-scores within the cohort ────────

function nanForNull(v: number | null): number {
  return v === null ? NaN : v;
}

// For each metric in `metrics`, z-score the own value against the cohort, then
// average. Metrics where this ticker's value is missing are skipped (not zero-
// filled — a missing metric shouldn't drag the pillar toward the cohort mean).
// Returns null if every metric in the pillar is missing for this ticker.
function pillarZ(
  metrics: ReadonlyArray<{ own: number | null; cohort: ReadonlyArray<number> }>,
): number | null {
  const zs: number[] = [];
  for (const m of metrics) {
    if (m.own === null || !Number.isFinite(m.own)) continue;
    zs.push(zScoreInCohort(m.own, m.cohort));
  }
  if (zs.length === 0) return null;
  let sum = 0;
  for (const z of zs) sum += z;
  return sum / zs.length;
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Compute Q-scores for every ticker in a layer cohort.
 *
 * Contract: all `inputs` must share the same `layer`. Mixing layers in one
 * call breaks the "z-score within layer" invariant; the function throws to
 * surface the bug rather than silently returning wrong scores.
 */
export function computeQForCohort(inputs: ReadonlyArray<QInputs>): QResult[] {
  if (inputs.length === 0) return [];
  const layer = inputs[0].layer;
  for (const inp of inputs) {
    if (inp.layer !== layer) {
      throw new Error(
        `computeQForCohort: all inputs must share a layer (got ${inp.layer} and ${layer})`,
      );
    }
  }

  // 1. Derive primitive metrics per ticker.
  const derived = inputs.map(derive);

  // 2. Build cohort arrays per metric for z-scoring. Use NaN sentinel so the
  //    cohort math in stats.ts can filter cleanly without losing positional
  //    alignment.
  const cohortGpTa = derived.map((d) => nanForNull(d.gpTa));
  const cohortRoic = derived.map((d) => nanForNull(d.roic));
  const cohortFcfRev = derived.map((d) => nanForNull(d.fcfRev));
  const cohortOpMargin = derived.map((d) => nanForNull(d.opMargin));
  const cohortGpTa5y = derived.map((d) => nanForNull(d.gpTa_5y));
  const cohortRoic5y = derived.map((d) => nanForNull(d.roic_5y));
  const cohortFcfRev5y = derived.map((d) => nanForNull(d.fcfRev_5y));
  const cohortOpMargin5y = derived.map((d) => nanForNull(d.opMargin_5y));
  // Safety: negate beta/leverage/EPS-vol so high = safer (matches the pillar
  // intent). altmanZ stays positive — see the module header for the deviation
  // from the spec pseudocode and the rationale.
  const cohortNegBeta = derived.map((d) => nanForNull(d.beta === null ? null : -d.beta));
  const cohortNegLev = derived.map((d) => nanForNull(d.leverage === null ? null : -d.leverage));
  const cohortNegEpsVol = derived.map((d) => nanForNull(d.epsVol === null ? null : -d.epsVol));
  const cohortAltmanZ = derived.map((d) => nanForNull(d.altmanZ));
  const cohortPayoutYield = derived.map((d) => nanForNull(d.payoutYield));

  // 3. Compute pillar z-scores per ticker, then composite z, then percentile.
  const weights = pillarWeights(layer);

  const pillarZs: QPillars[] = derived.map((d) => ({
    profitability: pillarZ([
      { own: d.gpTa, cohort: cohortGpTa },
      { own: d.roic, cohort: cohortRoic },
      { own: d.fcfRev, cohort: cohortFcfRev },
      { own: d.opMargin, cohort: cohortOpMargin },
    ]),
    growth: pillarZ([
      { own: d.gpTa_5y, cohort: cohortGpTa5y },
      { own: d.roic_5y, cohort: cohortRoic5y },
      { own: d.fcfRev_5y, cohort: cohortFcfRev5y },
      { own: d.opMargin_5y, cohort: cohortOpMargin5y },
    ]),
    safety: pillarZ([
      { own: d.beta === null ? null : -d.beta, cohort: cohortNegBeta },
      { own: d.leverage === null ? null : -d.leverage, cohort: cohortNegLev },
      { own: d.epsVol === null ? null : -d.epsVol, cohort: cohortNegEpsVol },
      { own: d.altmanZ, cohort: cohortAltmanZ },
    ]),
    payout: pillarZ([
      { own: d.payoutYield, cohort: cohortPayoutYield },
    ]),
  }));

  // Composite z (treat null pillar contributions as 0 — equivalent to
  // saying "neutral" rather than "we don't know"). If every pillar is null,
  // the qScore stays null.
  const compositeZ: Array<number | null> = pillarZs.map((p) => {
    const parts: Array<{ w: number; z: number | null }> = [
      { w: weights.profitability, z: p.profitability },
      { w: weights.growth, z: p.growth },
      { w: weights.safety, z: p.safety },
      { w: weights.payout, z: p.payout },
    ];
    if (parts.every((x) => x.z === null)) return null;
    let sum = 0;
    for (const x of parts) sum += x.w * (x.z ?? 0);
    return sum;
  });

  // Percentile rank within the cohort distribution of composite z.
  const finiteComposite: number[] = compositeZ.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );

  return inputs.map((inp, i) => {
    const d = derived[i];
    const cz = compositeZ[i];
    const qScore = cz === null ? null : percentileRankInCohort(cz, finiteComposite);
    return {
      ticker: inp.ticker,
      layer: inp.layer,
      qScore,
      compositeZ: cz,
      pillars: pillarZs[i],
      metrics: {
        gpOverAssets: d.gpTa,
        roic: d.roic,
        fcfOverRevenue: d.fcfRev,
        operatingMargin: d.opMargin,
        leverage: d.leverage,
        altmanZ: d.altmanZ,
        epsVolatility: d.epsVol,
        beta: d.beta,
        payoutYield: d.payoutYield,
        effectiveTaxRate: d.effectiveTaxRate,
        gpOverAssets_5y_delta: d.gpTa_5y,
        roic_5y_delta: d.roic_5y,
        fcfOverRevenue_5y_delta: d.fcfRev_5y,
        operatingMargin_5y_delta: d.opMargin_5y,
      },
    };
  });
}

// Re-export the weight rule for downstream callers / tests.
export const _internals = { pillarWeights };

// THS-43 — V-score: PEG-like + adjusted FCF yield + own-history forward
// P/E z, with the §Fix 5 depreciation/Burry penalty applied as a final
// negative adjustment.
//
// Spec: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §compute_v_score,
// §Fix 5 (scaled depreciation penalty), §Fix 6 (maintenance capex bands).
//
// Three sub-signals, z-scored within layer, equal-weighted average,
// percentile-rank → raw_v (0..100). Then raw_v + depreciation_penalty
// (penalty is ≤ 0; capped at −12 per spec), clamped to [0, 100].
//
// Sign discipline so all three signals are "higher = better" before
// z-scoring:
//   - PEG-like (lower = cheaper = better) → negate before cohort z
//   - Adjusted FCF yield (higher = better)                → use as-is
//   - Own-history fwd P/E z (lower = cheap vs own history = better)
//     → use `-z` per spec; pre-negation in the signal output
//
// Graceful degradation on the own-history fwd P/E sub-signal (Terry's
// spec): < 90 daily obs → sub-signal dropped (NULL); 90..365 → computed
// with `confidence: 'low'` flagged in factor_breakdown; 365+ → full
// confidence; window = min(5y = 1260 obs, available history).
//
// Maintenance capex per §Fix 6 uses the `mid` default (50% of current
// capex). `low` (5y pre-AI-cycle ratio) and `high` (70%) bands are
// future work; not enough history in v1 to compute the `low` estimate.

import { mean, percentileRankInCohort, stddev, zScoreInCohort } from "./stats.ts";

export type Layer = 1 | 2 | 3 | 4 | 5;

/**
 * Raw inputs per ticker. TTM aggregates come from the trailing four
 * quarters of fundamentals; latest balance-sheet snapshots come from the
 * most recent quarter; market cap is latest close × shares_diluted.
 */
export interface VInputs {
  ticker: string;
  layer: Layer;
  // TTM aggregates.
  ttmRevenue: number | null;
  ttmOperatingIncome: number | null;
  ttmDepreciationAmortization: number | null;
  ttmFcf: number | null;
  ttmCapex: number | null;
  // Latest snapshots.
  latestTotalDebt: number | null;
  latestCash: number | null;
  marketCap: number | null;
  ntmRevenue: number | null;
  forwardPeToday: number | null;
  // Daily forward-P/E series (oldest first). 5y = ~1260 obs. Can be empty
  // if ingestion just started.
  forwardPeHistory: ReadonlyArray<number | null>;
  // From depreciation_flags. ≤ 0. 0 when no flag exists for this ticker.
  depreciationPenalty: number;
}

export type Confidence = "none" | "low" | "full";

export interface VSignals {
  // Raw signal values (pre-negation, pre-z).
  pegLike: number | null;
  adjFcfYield: number | null;
  ownHistoryFwdPeZ: number | null;
  // Audit trail.
  ev: number | null;
  ebitda: number | null;
  evEbitda: number | null;
  ntmGrowth: number | null;
  maintenanceCapex: number | null;
  forwardPeMean: number | null;
  forwardPeStd: number | null;
  forwardPeObs: number;
  forwardPeConfidence: Confidence;
}

export interface VResult {
  ticker: string;
  layer: Layer;
  vScore: number | null;        // 0..100 after penalty, or null if no signals
  rawV: number | null;          // 0..100 before penalty
  penalty: number;              // ≤ 0
  compositeZ: number | null;
  signals: VSignals;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const FIVE_YEAR_TRADING_DAYS = 5 * 252;
const LOW_CONFIDENCE_THRESHOLD = 90;
const FULL_CONFIDENCE_THRESHOLD = 365;

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function nanForNull(v: number | null): number {
  return v === null ? NaN : v;
}

// EBITDA = operating_income + D&A. Returns null if either input is missing.
export function ebitda(opIncome: number | null, dna: number | null): number | null {
  if (!isFiniteNumber(opIncome) || !isFiniteNumber(dna)) return null;
  return opIncome + dna;
}

// Enterprise value = market cap + total_debt − cash. Returns null if any
// component is missing or EV is non-positive (where multiples don't apply).
export function enterpriseValue(
  marketCap: number | null,
  totalDebt: number | null,
  cash: number | null,
): number | null {
  if (!isFiniteNumber(marketCap)) return null;
  if (!isFiniteNumber(totalDebt)) return null;
  if (!isFiniteNumber(cash)) return null;
  const ev = marketCap + totalDebt - cash;
  if (ev <= 0) return null;
  return ev;
}

// PEG-like = EV/EBITDA / ntm_revenue_growth. Returns null when growth is
// non-positive (the ratio loses meaning at zero or negative growth).
export function pegLike(
  evVal: number | null,
  ebitdaVal: number | null,
  ntmGrowth: number | null,
): number | null {
  if (!isFiniteNumber(evVal) || !isFiniteNumber(ebitdaVal) || ebitdaVal <= 0) return null;
  if (!isFiniteNumber(ntmGrowth) || ntmGrowth <= 0) return null;
  return (evVal / ebitdaVal) / ntmGrowth;
}

// Adjusted FCF yield = (fcf + (capex − maintenance_capex)) / EV.
// With maintenance = 0.5 × capex (§Fix 6 mid default), this becomes
// (fcf + 0.5 × capex) / EV — i.e., we credit back half of current capex
// as "growth capex" that shouldn't be charged against owner earnings.
export function adjustedFcfYield(
  ttmFcf: number | null,
  ttmCapex: number | null,
  evVal: number | null,
  maintenanceCapex: number | null,
): number | null {
  if (!isFiniteNumber(ttmFcf) || !isFiniteNumber(ttmCapex)) return null;
  if (!isFiniteNumber(evVal) || evVal <= 0) return null;
  if (!isFiniteNumber(maintenanceCapex)) return null;
  return (ttmFcf + (ttmCapex - maintenanceCapex)) / evVal;
}

export function maintenanceCapexMid(ttmCapex: number | null): number | null {
  return isFiniteNumber(ttmCapex) ? 0.5 * ttmCapex : null;
}

/**
 * Own-history forward P/E z-score with graceful degradation.
 *
 * Returns:
 *   - value: NULL if fewer than 90 finite obs in window
 *   - obs count: how many observations the mean/std were computed over
 *   - confidence band: 'none' | 'low' | 'full'
 */
export function ownHistoryForwardPeZ(
  today: number | null,
  history: ReadonlyArray<number | null>,
): { z: number | null; meanVal: number | null; stdVal: number | null; obs: number; confidence: Confidence } {
  if (!isFiniteNumber(today)) {
    return { z: null, meanVal: null, stdVal: null, obs: 0, confidence: "none" };
  }
  // Window = the most recent min(5y, available) finite values.
  const finite: number[] = [];
  for (const v of history) {
    if (isFiniteNumber(v)) finite.push(v);
  }
  const window = finite.slice(-FIVE_YEAR_TRADING_DAYS);
  const obs = window.length;

  let confidence: Confidence = "none";
  if (obs >= FULL_CONFIDENCE_THRESHOLD) confidence = "full";
  else if (obs >= LOW_CONFIDENCE_THRESHOLD) confidence = "low";

  if (confidence === "none") {
    return { z: null, meanVal: null, stdVal: null, obs, confidence };
  }

  const m = mean(window);
  const s = stddev(window);
  if (!isFiniteNumber(s) || s === 0) {
    return { z: null, meanVal: m, stdVal: s, obs, confidence };
  }
  return { z: (today - m) / s, meanVal: m, stdVal: s, obs, confidence };
}

// ─── Per-ticker derivation ──────────────────────────────────────────────────

function ntmGrowth(inp: VInputs): number | null {
  if (!isFiniteNumber(inp.ntmRevenue) || !isFiniteNumber(inp.ttmRevenue) || inp.ttmRevenue <= 0) {
    return null;
  }
  return (inp.ntmRevenue - inp.ttmRevenue) / inp.ttmRevenue;
}

function deriveSignals(inp: VInputs): VSignals {
  const ev = enterpriseValue(inp.marketCap, inp.latestTotalDebt, inp.latestCash);
  const ebitdaVal = ebitda(inp.ttmOperatingIncome, inp.ttmDepreciationAmortization);
  const evEbitda = isFiniteNumber(ev) && isFiniteNumber(ebitdaVal) && ebitdaVal > 0
    ? ev / ebitdaVal
    : null;
  const growth = ntmGrowth(inp);
  const peg = pegLike(ev, ebitdaVal, growth);
  const maintenance = maintenanceCapexMid(inp.ttmCapex);
  const fcfYield = adjustedFcfYield(inp.ttmFcf, inp.ttmCapex, ev, maintenance);
  const own = ownHistoryForwardPeZ(inp.forwardPeToday, inp.forwardPeHistory);

  return {
    pegLike: peg,
    adjFcfYield: fcfYield,
    ownHistoryFwdPeZ: own.z,
    ev,
    ebitda: ebitdaVal,
    evEbitda,
    ntmGrowth: growth,
    maintenanceCapex: maintenance,
    forwardPeMean: own.meanVal,
    forwardPeStd: own.stdVal,
    forwardPeObs: own.obs,
    forwardPeConfidence: own.confidence,
  };
}

// ─── Cohort assembly ────────────────────────────────────────────────────────

/**
 * Compute V-scores for every ticker in a layer cohort. All inputs must
 * share the same `layer`.
 */
export function computeVForCohort(inputs: ReadonlyArray<VInputs>): VResult[] {
  if (inputs.length === 0) return [];
  const layer = inputs[0].layer;
  for (const inp of inputs) {
    if (inp.layer !== layer) {
      throw new Error(
        `computeVForCohort: all inputs must share a layer (got ${inp.layer} and ${layer})`,
      );
    }
  }

  const signals: VSignals[] = inputs.map(deriveSignals);

  // Build cohort arrays per signal in their "higher = better" orientation:
  //   - −pegLike (so cheap = high)
  //   - +adjFcfYield (high yield = high)
  //   - −ownHistoryFwdPeZ (cheap vs own history = high)
  const cohortPeg = signals.map((s) => nanForNull(s.pegLike === null ? null : -s.pegLike));
  const cohortFcf = signals.map((s) => nanForNull(s.adjFcfYield));
  const cohortOwn = signals.map((s) => nanForNull(s.ownHistoryFwdPeZ === null ? null : -s.ownHistoryFwdPeZ));

  // Composite z per ticker: average of available signal z-scores.
  const compositeZ: Array<number | null> = signals.map((s) => {
    const zs: number[] = [];
    if (s.pegLike !== null) zs.push(zScoreInCohort(-s.pegLike, cohortPeg));
    if (s.adjFcfYield !== null) zs.push(zScoreInCohort(s.adjFcfYield, cohortFcf));
    if (s.ownHistoryFwdPeZ !== null) zs.push(zScoreInCohort(-s.ownHistoryFwdPeZ, cohortOwn));
    if (zs.length === 0) return null;
    let sum = 0;
    for (const z of zs) sum += z;
    return sum / zs.length;
  });

  // Raw V = percentile rank of composite z within the cohort.
  const finiteComposite: number[] = compositeZ.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );

  return inputs.map((inp, i) => {
    const cz = compositeZ[i];
    const rawV = cz === null ? null : percentileRankInCohort(cz, finiteComposite);
    const penalty = clampPenalty(inp.depreciationPenalty);
    const vScore = rawV === null ? null : clamp01(rawV + penalty);
    return {
      ticker: inp.ticker,
      layer: inp.layer,
      vScore,
      rawV,
      penalty,
      compositeZ: cz,
      signals: signals[i],
    };
  });
}

// Penalty is ≤ 0; cap at −12 per spec §Fix 5. A positive penalty is a
// caller bug; clamp to 0 defensively.
function clampPenalty(p: number): number {
  if (!isFiniteNumber(p)) return 0;
  if (p > 0) return 0;
  if (p < -12) return -12;
  return p;
}

function clamp01(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

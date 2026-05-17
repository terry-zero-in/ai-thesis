// THS-42 — G-score: NTM revenue growth + AI-segment proxy + capex efficiency.
//
// Spec: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §compute_g_score and
// §Fix 4 (layer-specific AI-segment + capex-efficiency formulas).
//
// Three equal-weighted signals, z-scored within the layer cohort, then
// averaged and percentile-ranked to 0..100. Same cohort-assembly shape as
// factor-q so the orchestrator edge function looks identical.
//
// Layer-specific signals (§Fix 4):
//   L1 Compute      AI segment = data-center revenue YoY;
//                   capex eff  = TTM revenue / TTM capex
//   L2 Hyperscaler  AI segment = ΔTTM revenue / ΔTTM capex (Goldman's
//                                "revealed phase shift" metric);
//                   capex eff  = ΔTTM revenue / ΔTTM capex (same shape)
//   L3 App          AI segment = AI ARR / TTM opex (capital-light proxy);
//                   capex eff  = 1 − TTM capex / TTM revenue
//   L4 Power        AI segment = override AI revenue / TTM capex
//                                (fallback: TTM revenue / TTM capex —
//                                 contracted MW pipeline data isn't in any
//                                 standard provider);
//                   capex eff  = TTM revenue / TTM capex
//   L5 Incumbent    AI segment = AI ARR / (R&D + capex);
//                   capex eff  = TTM revenue / (TTM R&D + TTM capex)
//
// Override behavior: when `ai_segment_overrides.ai_revenue` is present we
// use it; when null/missing we fall back to the layer's default proxy
// using overall fundamentals. This matches Terry's "curated overrides +
// layer defaults" decision in §Fix 4.

import { percentileRankInCohort, zScoreInCohort } from "./stats.ts";

export type Layer = 1 | 2 | 3 | 4 | 5;

/**
 * Per-ticker raw inputs for the G-score. TTM aggregates are computed
 * upstream from trailing four quarters of `fundamentals_raw`; the
 * `_lag1y` companions are TTM from the four quarters ending exactly one
 * year earlier (so ΔTTM = now − lag1y is incremental year-over-year).
 */
export interface GInputs {
  ticker: string;
  layer: Layer;
  // TTM aggregates from the latest four quarters.
  ttmRevenue: number | null;
  ttmCapex: number | null;
  ttmOperatingIncome: number | null;
  ttmRdExpense: number | null;
  // TTM aggregates ending one year earlier (for incremental / YoY math).
  ttmRevenue_lag1y: number | null;
  ttmCapex_lag1y: number | null;
  // Latest consensus snapshot.
  ntmRevenue: number | null;
  // ai_segment_overrides: latest row + same row a year prior (for YoY).
  // Either may be null when the curated table doesn't carry the name.
  aiRevenue_current: number | null;
  aiRevenue_lag1y: number | null;
}

export interface GSignals {
  ntmGrowth: number | null;
  aiSegment: number | null;
  capexEfficiency: number | null;
}

export interface GResult {
  ticker: string;
  layer: Layer;
  gScore: number | null;     // 0..100, or null if all signals missing
  compositeZ: number | null;
  signals: GSignals;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function safeDiv(num: number | null, den: number | null): number | null {
  if (!isFiniteNumber(num) || !isFiniteNumber(den) || den === 0) return null;
  return num / den;
}

// pct change with positive-base guard — negative or zero base yields null
// because (a-b)/b loses sign meaning when b ≤ 0.
function pctChange(now: number | null, lag: number | null): number | null {
  if (!isFiniteNumber(now) || !isFiniteNumber(lag) || lag <= 0) return null;
  return (now - lag) / lag;
}

function nanForNull(v: number | null): number {
  return v === null ? NaN : v;
}

// ─── Signals ────────────────────────────────────────────────────────────────

// NTM growth is layer-agnostic. Negative TTM revenue is nonsensical here so
// we drop those names rather than emit a negative-base growth rate.
export function ntmGrowth(inp: GInputs): number | null {
  return pctChange(inp.ntmRevenue, inp.ttmRevenue);
}

export function aiSegmentSignal(inp: GInputs): number | null {
  switch (inp.layer) {
    case 1: {
      // Prefer override YoY; fall back to overall revenue YoY when no
      // curated AI-revenue history exists.
      const fromOverride = pctChange(inp.aiRevenue_current, inp.aiRevenue_lag1y);
      if (fromOverride !== null) return fromOverride;
      return pctChange(inp.ttmRevenue, inp.ttmRevenue_lag1y);
    }
    case 2: {
      // ΔTTM revenue / ΔTTM capex — the "revealed phase shift" metric.
      if (!isFiniteNumber(inp.ttmRevenue) || !isFiniteNumber(inp.ttmRevenue_lag1y)) return null;
      if (!isFiniteNumber(inp.ttmCapex) || !isFiniteNumber(inp.ttmCapex_lag1y)) return null;
      const deltaRev = inp.ttmRevenue - inp.ttmRevenue_lag1y;
      const deltaCapex = inp.ttmCapex - inp.ttmCapex_lag1y;
      if (deltaCapex === 0) return null;
      return deltaRev / deltaCapex;
    }
    case 3: {
      // AI ARR / total opex; opex = revenue − operating_income.
      if (!isFiniteNumber(inp.ttmRevenue) || !isFiniteNumber(inp.ttmOperatingIncome)) return null;
      const opex = inp.ttmRevenue - inp.ttmOperatingIncome;
      if (opex <= 0) return null;
      const numerator = inp.aiRevenue_current ?? inp.ttmRevenue;
      if (!isFiniteNumber(numerator)) return null;
      return numerator / opex;
    }
    case 4: {
      // Spec wants contracted hyperscaler MW pipeline value / capex; that
      // data isn't in any standard provider. Use override AI revenue when
      // present, fall back to overall TTM revenue / TTM capex.
      if (!isFiniteNumber(inp.ttmCapex) || inp.ttmCapex <= 0) return null;
      const numerator = inp.aiRevenue_current ?? inp.ttmRevenue;
      if (!isFiniteNumber(numerator)) return null;
      return numerator / inp.ttmCapex;
    }
    case 5: {
      // AI ARR / (R&D + capex). When override missing, fall back to total
      // revenue / (R&D + capex) — same shape as capex efficiency below,
      // which causes the two signals to align on names without an override.
      if (!isFiniteNumber(inp.ttmRdExpense) || !isFiniteNumber(inp.ttmCapex)) return null;
      const denominator = inp.ttmRdExpense + inp.ttmCapex;
      if (denominator <= 0) return null;
      const numerator = inp.aiRevenue_current ?? inp.ttmRevenue;
      if (!isFiniteNumber(numerator)) return null;
      return numerator / denominator;
    }
  }
}

export function capexEfficiency(inp: GInputs): number | null {
  switch (inp.layer) {
    case 1:
      return safeDiv(inp.ttmRevenue, inp.ttmCapex);
    case 2: {
      if (!isFiniteNumber(inp.ttmRevenue) || !isFiniteNumber(inp.ttmRevenue_lag1y)) return null;
      if (!isFiniteNumber(inp.ttmCapex) || !isFiniteNumber(inp.ttmCapex_lag1y)) return null;
      const deltaCapex = inp.ttmCapex - inp.ttmCapex_lag1y;
      if (deltaCapex === 0) return null;
      return (inp.ttmRevenue - inp.ttmRevenue_lag1y) / deltaCapex;
    }
    case 3: {
      if (!isFiniteNumber(inp.ttmRevenue) || inp.ttmRevenue <= 0) return null;
      if (!isFiniteNumber(inp.ttmCapex)) return null;
      return 1 - inp.ttmCapex / inp.ttmRevenue;
    }
    case 4:
      return safeDiv(inp.ttmRevenue, inp.ttmCapex);
    case 5: {
      if (!isFiniteNumber(inp.ttmRdExpense) || !isFiniteNumber(inp.ttmCapex)) return null;
      const denominator = inp.ttmRdExpense + inp.ttmCapex;
      if (denominator <= 0) return null;
      return safeDiv(inp.ttmRevenue, denominator);
    }
  }
}

// ─── Cohort assembly ────────────────────────────────────────────────────────

/**
 * Compute G-scores for every ticker in a layer cohort. All inputs must
 * share the same `layer`; mixing throws so a caller bug doesn't silently
 * produce nonsense z-scores.
 */
export function computeGForCohort(inputs: ReadonlyArray<GInputs>): GResult[] {
  if (inputs.length === 0) return [];
  const layer = inputs[0].layer;
  for (const inp of inputs) {
    if (inp.layer !== layer) {
      throw new Error(
        `computeGForCohort: all inputs must share a layer (got ${inp.layer} and ${layer})`,
      );
    }
  }

  // 1. Derive the three raw signals per ticker.
  const signals: GSignals[] = inputs.map((inp) => ({
    ntmGrowth: ntmGrowth(inp),
    aiSegment: aiSegmentSignal(inp),
    capexEfficiency: capexEfficiency(inp),
  }));

  // 2. Cohort arrays per signal for z-scoring. NaN sentinel so the stats
  //    module's NaN-filtering keeps positional alignment.
  const cohortNtm = signals.map((s) => nanForNull(s.ntmGrowth));
  const cohortAi = signals.map((s) => nanForNull(s.aiSegment));
  const cohortCe = signals.map((s) => nanForNull(s.capexEfficiency));

  // 3. Composite z = average of available signal z-scores (skip missing).
  const compositeZ: Array<number | null> = signals.map((s) => {
    const zs: number[] = [];
    if (s.ntmGrowth !== null) zs.push(zScoreInCohort(s.ntmGrowth, cohortNtm));
    if (s.aiSegment !== null) zs.push(zScoreInCohort(s.aiSegment, cohortAi));
    if (s.capexEfficiency !== null) zs.push(zScoreInCohort(s.capexEfficiency, cohortCe));
    if (zs.length === 0) return null;
    let sum = 0;
    for (const z of zs) sum += z;
    return sum / zs.length;
  });

  // 4. Percentile rank within the cohort distribution of composite z.
  const finiteComposite: number[] = compositeZ.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );

  return inputs.map((inp, i) => {
    const cz = compositeZ[i];
    return {
      ticker: inp.ticker,
      layer: inp.layer,
      gScore: cz === null ? null : percentileRankInCohort(cz, finiteComposite),
      compositeZ: cz,
      signals: signals[i],
    };
  });
}

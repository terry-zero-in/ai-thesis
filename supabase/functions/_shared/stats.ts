// THS-44 — Cross-sectional statistics helpers used by Tier-A scoring.
//
// All functions are pure: no DB, no factor logic, no Supabase or Deno imports.
// The factor compute layer (THS-41/42/43) loads the layer × as-of cohort from
// Postgres and hands the raw numbers in here.
//
// Edge-case contract (per THS-44 acceptance):
//   - single name in cohort  → z-score returns 0 (neutral), not Infinity
//   - all-equal cohort       → z-score returns 0, percentile-rank returns 50
//   - missing data (NaN/null) → silently filtered from cohort stats; input
//                                values that are non-finite return NaN out so
//                                the caller can decide null vs. drop

const DEFAULT_WINSOR_P = 0.02;

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export function mean(values: ReadonlyArray<number>): number {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (isFiniteNumber(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? NaN : sum / n;
}

// Sample standard deviation (N-1 denominator). Returns 0 when n < 2 or all
// finite values are equal — that's the degenerate-cohort signal the rest of
// this module checks for to avoid division-by-zero.
export function stddev(values: ReadonlyArray<number>): number {
  const finite: number[] = [];
  for (const v of values) if (isFiniteNumber(v)) finite.push(v);
  if (finite.length < 2) return 0;
  const m = mean(finite);
  let ss = 0;
  for (const v of finite) {
    const d = v - m;
    ss += d * d;
  }
  return Math.sqrt(ss / (finite.length - 1));
}

// Clip every value to the [p, 1-p] empirical quantile of the cohort's finite
// values. Default p = 0.02 (2nd / 98th percentile) per the algorithm spec.
// Non-finite inputs (NaN / undefined-as-NaN) pass through untouched.
export function winsorize(
  values: ReadonlyArray<number>,
  p: number = DEFAULT_WINSOR_P,
): number[] {
  if (!Number.isFinite(p) || p < 0 || p >= 0.5) {
    throw new Error(`winsorize: p must be in [0, 0.5), got ${p}`);
  }
  const finite: number[] = [];
  for (const v of values) if (isFiniteNumber(v)) finite.push(v);
  if (finite.length < 2 || p === 0) return values.slice();

  finite.sort((a, b) => a - b);
  const lo = quantileSorted(finite, p);
  const hi = quantileSorted(finite, 1 - p);
  return values.map((v) => {
    if (!isFiniteNumber(v)) return v;
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  });
}

// Linear-interpolated quantile on a pre-sorted finite array.
function quantileSorted(sorted: ReadonlyArray<number>, q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Z-score a value against a cohort. Degenerate cohorts (n < 2 or std = 0)
// return 0 — neutral — instead of poisoning the composite with Infinity / NaN.
export function zScoreInCohort(
  value: number,
  cohort: ReadonlyArray<number>,
): number {
  if (!isFiniteNumber(value)) return NaN;
  const s = stddev(cohort);
  if (s === 0) return 0;
  const m = mean(cohort);
  if (!isFiniteNumber(m)) return 0;
  return (value - m) / s;
}

// Empirical percentile rank of a value within a cohort, on 0..100.
// Ties use the midpoint convention so all-equal cohorts return 50.
//
// Preferred over `percentileFromZ` when cohorts are small (n < ~30) or the
// factor distribution is meaningfully non-normal — empirical rank is robust to
// both, distribution-aware mapping is not.
export function percentileRankInCohort(
  value: number,
  cohort: ReadonlyArray<number>,
): number {
  if (!isFiniteNumber(value)) return NaN;
  let n = 0;
  let below = 0;
  let equal = 0;
  for (const v of cohort) {
    if (!isFiniteNumber(v)) continue;
    n++;
    if (v < value) below++;
    else if (v === value) equal++;
  }
  if (n === 0) return NaN;
  const rank = below + 0.5 * equal;
  return (rank / n) * 100;
}

// Map a z-score to a 0..100 percentile via the standard-normal CDF.
// Use when the cohort is large enough and roughly normal; for the 50-name
// universe with layer cohorts of 6..14 names, prefer percentileRankInCohort.
export function percentileFromZ(z: number): number {
  if (!isFiniteNumber(z)) return NaN;
  return normalCdf(z) * 100;
}

// Abramowitz & Stegun 7.1.26 — closed-form erf approximation, ~7.5e-8 max err.
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const erf =
    1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

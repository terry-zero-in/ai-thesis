// THS-59 (E5.2) — Options surface metrics.
//
// Pure helpers — no I/O, no SDK imports. Takes a list of contracts
// (typically from Polygon's `/v3/snapshot/options/{underlying}`) and
// returns three signals the S-score and analytical surfaces consume.
//
// All three signals are noise-tolerant: small contract counts return
// null rather than degenerate values, and contracts missing greeks /
// IV are skipped (not extrapolated). Cohort z-scoring in factor-s
// handles partial coverage; better to return null and let the cohort
// rescale than to fabricate a number.

export interface OptionContract {
  /** "call" | "put" — anything else is ignored. */
  contract_type: string;
  /** Strike (used only for sanity; greeks carry the real info). */
  strike: number | null;
  /** Days to expiration. */
  dte: number | null;
  /** Open interest. Used for P/C ratio. */
  open_interest: number | null;
  /** Implied volatility (decimal — 0.40 = 40%). */
  implied_volatility: number | null;
  /** Delta (signed; calls positive, puts negative). */
  delta: number | null;
}

export interface OptionsMetrics {
  put_call_ratio: number | null;
  skew_25d: number | null;
  iv_term_slope: number | null;
  contracts_used: number;
}

export const SHORT_TERM_DTE_MAX = 60;
export const LONG_TERM_DTE_MIN = 60;
export const LONG_TERM_DTE_MAX = 150;
export const SKEW_TARGET_DELTA = 0.25;
/** Tolerance band around 25Δ — accept any contract within ±10Δ to avoid
 *  going null when the exact 25Δ strike isn't listed. We pick the
 *  closest to 0.25 within the band. */
export const SKEW_DELTA_TOLERANCE = 0.1;
export const MIN_CONTRACTS_FOR_METRICS = 8;

export function computeOptionsMetrics(contracts: ReadonlyArray<OptionContract>): OptionsMetrics {
  const valid = contracts.filter(isUsableContract);
  if (valid.length < MIN_CONTRACTS_FOR_METRICS) {
    return { put_call_ratio: null, skew_25d: null, iv_term_slope: null, contracts_used: valid.length };
  }

  return {
    put_call_ratio: computePutCallRatio(valid),
    skew_25d: computeSkew25d(valid),
    iv_term_slope: computeIvTermSlope(valid),
    contracts_used: valid.length,
  };
}

// ---------------------------------------------------------------------------
// P/C ratio — total put OI / total call OI.
// ---------------------------------------------------------------------------

function computePutCallRatio(contracts: ReadonlyArray<OptionContract>): number | null {
  let callOi = 0;
  let putOi = 0;
  for (const c of contracts) {
    if (c.open_interest == null || !Number.isFinite(c.open_interest)) continue;
    if (c.contract_type === "call") callOi += c.open_interest;
    else if (c.contract_type === "put") putOi += c.open_interest;
  }
  if (callOi <= 0) return null;
  return putOi / callOi;
}

// ---------------------------------------------------------------------------
// 25Δ skew — IV(25Δ put) - IV(25Δ call).
//
// We restrict to short-dated contracts (DTE ≤ 60) since longer-dated
// skew is dominated by demand for protection rather than directional
// view. Picks the contract whose |delta| is closest to 0.25 within a
// ±0.10 band on each side; returns null if either side isn't found.
// ---------------------------------------------------------------------------

function computeSkew25d(contracts: ReadonlyArray<OptionContract>): number | null {
  const shortDated = contracts.filter((c) => c.dte != null && c.dte <= SHORT_TERM_DTE_MAX);
  if (shortDated.length === 0) return null;

  const callMatch = closestToTargetDelta(shortDated, "call");
  const putMatch = closestToTargetDelta(shortDated, "put");
  if (callMatch == null || putMatch == null) return null;
  if (callMatch.implied_volatility == null || putMatch.implied_volatility == null) return null;
  return putMatch.implied_volatility - callMatch.implied_volatility;
}

function closestToTargetDelta(
  contracts: ReadonlyArray<OptionContract>,
  type: "call" | "put",
): OptionContract | null {
  let best: OptionContract | null = null;
  let bestDist = Infinity;
  for (const c of contracts) {
    if (c.contract_type !== type) continue;
    if (c.delta == null || !Number.isFinite(c.delta)) continue;
    if (c.implied_volatility == null || !Number.isFinite(c.implied_volatility)) continue;
    const absDelta = Math.abs(c.delta);
    const dist = Math.abs(absDelta - SKEW_TARGET_DELTA);
    if (dist > SKEW_DELTA_TOLERANCE) continue;
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// IV term slope — mean IV of long-dated contracts minus mean IV of
// short-dated. Positive = contango (calm). Negative = backwardation
// (stress). Computed across both calls and puts so it represents the
// surface, not a directional view.
// ---------------------------------------------------------------------------

function computeIvTermSlope(contracts: ReadonlyArray<OptionContract>): number | null {
  const shortIvs: number[] = [];
  const longIvs: number[] = [];
  for (const c of contracts) {
    if (c.implied_volatility == null || !Number.isFinite(c.implied_volatility)) continue;
    if (c.dte == null) continue;
    if (c.dte <= SHORT_TERM_DTE_MAX) shortIvs.push(c.implied_volatility);
    else if (c.dte > LONG_TERM_DTE_MIN && c.dte <= LONG_TERM_DTE_MAX) longIvs.push(c.implied_volatility);
  }
  if (shortIvs.length === 0 || longIvs.length === 0) return null;
  return mean(longIvs) - mean(shortIvs);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUsableContract(c: OptionContract): boolean {
  if (c.contract_type !== "call" && c.contract_type !== "put") return false;
  // At least one of (open_interest, implied_volatility) must be present
  // — a contract with neither contributes to none of the three metrics.
  return (
    (c.open_interest != null && Number.isFinite(c.open_interest)) ||
    (c.implied_volatility != null && Number.isFinite(c.implied_volatility))
  );
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

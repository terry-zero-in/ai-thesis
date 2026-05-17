// THS-67 (E6.5) — Quarterly review checklist.
//
// Pure helper — no DB / SDK imports. Caller assembles inputs (recent
// dep-flag rows, latest two AIQ rubric rows per ticker, hyperscaler
// price windows, current/prior trailing-12mo capex, annual-trigger
// flag) and hands them in. The helper returns an array of findings
// the orchestrator persists as JSONB on `quarterly_reviews.findings`.
//
// Spec acceptance (from THS-67):
//   1. Any L2 ticker changed useful-life policy? → new dep flags
//   2. Any AIQ drift > 10 pts? → latest vs prior aiq_rubric.total
//   3. Hyperscaler pairwise correlation moved > 0.20?
//   4. Consensus 2026/2027 capex moved > 10%?
//   5. Annual walk-forward re-optimize trigger fires once a year
//
// Check #4 is partially blocked: the `consensus` table holds analyst
// EPS estimates, not capex estimates. We surface check #4 as a
// "data_gap" finding listing what trailing-12mo capex deltas we CAN
// observe via fundamentals_raw, and flag the consensus-capex column
// as a follow-on. Honest, not silently skipped.

export const AIQ_DRIFT_THRESHOLD = 10;
export const HYPERSCALER_CORR_DELTA_THRESHOLD = 0.2;
export const CAPEX_DELTA_THRESHOLD_PCT = 10;

export type FindingSeverity = "info" | "warn" | "high" | "data_gap";

export type CheckId =
  | "useful_life_policy"
  | "aiq_drift"
  | "hyperscaler_correlation"
  | "consensus_capex"
  | "annual_walk_forward";

export interface Finding {
  check_id: CheckId;
  severity: FindingSeverity;
  summary: string;
  detail: string;
  /** Structured payload — varies by check. UI may render selectively. */
  data?: Record<string, unknown>;
}

export interface DepFlagRow {
  ticker: string;
  flagged_at: string;
  extension_years: number | null;
  penalty_v: number | null;
}

export interface AiqRubricSnap {
  ticker: string;
  scored_at: string;
  total: number | null;
}

/** 90-day daily returns per hyperscaler ticker for current + prior windows. */
export interface HyperscalerReturnsWindow {
  current: Map<string, number[]>;
  prior: Map<string, number[]>;
}

export interface CapexSnap {
  ticker: string;
  /** Trailing-12mo capex (sum of last 4 Q rows) at the review date. */
  current_ttm_capex: number | null;
  /** Trailing-12mo capex one year earlier. */
  prior_ttm_capex: number | null;
}

export interface QuarterlyInputs {
  as_of: string;
  /** Earliest date a dep-flag must be on/after to count as "new this quarter". */
  window_start: string;
  /** New depreciation_flags rows in [window_start, as_of]. */
  newDepFlags: DepFlagRow[];
  /** Up to two AIQ rubric rows per ticker (latest two), ordered scored_at desc. */
  aiqByTicker: Map<string, AiqRubricSnap[]>;
  /** Hyperscaler 90-day daily returns for current + prior windows. */
  hyperscalerReturns: HyperscalerReturnsWindow;
  /** Hyperscaler trailing-12mo capex snapshots (current + prior year). */
  hyperscalerCapex: CapexSnap[];
  /** True only on Q1 (Feb) review — fires the annual walk-forward. */
  is_annual_trigger: boolean;
}

export function buildQuarterlyChecklist(inputs: QuarterlyInputs): Finding[] {
  const findings: Finding[] = [];

  findings.push(checkUsefulLifePolicy(inputs.newDepFlags, inputs.window_start, inputs.as_of));
  findings.push(checkAiqDrift(inputs.aiqByTicker));
  findings.push(checkHyperscalerCorrelation(inputs.hyperscalerReturns));
  findings.push(checkConsensusCapex(inputs.hyperscalerCapex));
  if (inputs.is_annual_trigger) findings.push(checkAnnualWalkForward(inputs.as_of));

  return findings;
}

// ---------------------------------------------------------------------------
// Check 1: useful-life / depreciation policy changes
// ---------------------------------------------------------------------------

function checkUsefulLifePolicy(
  rows: DepFlagRow[],
  windowStart: string,
  asOf: string,
): Finding {
  const relevant = rows.filter((r) => r.flagged_at >= windowStart && r.flagged_at <= asOf);
  if (relevant.length === 0) {
    return {
      check_id: "useful_life_policy",
      severity: "info",
      summary: "No new useful-life / depreciation policy changes this quarter.",
      detail: `No depreciation_flags rows added between ${windowStart} and ${asOf}.`,
      data: { tickers: [], window_start: windowStart, as_of: asOf },
    };
  }
  const tickers = Array.from(new Set(relevant.map((r) => r.ticker))).sort();
  const lines = relevant
    .slice()
    .sort((a, b) => (a.flagged_at < b.flagged_at ? 1 : -1))
    .map((r) => {
      const ext = r.extension_years == null ? "?" : `+${r.extension_years}y`;
      const pen = r.penalty_v == null ? "?" : String(r.penalty_v);
      return `  • ${r.ticker} (${r.flagged_at}): extension ${ext}, V penalty ${pen}`;
    });
  return {
    check_id: "useful_life_policy",
    severity: "high",
    summary: `${tickers.length} ticker(s) flagged this quarter: ${tickers.join(", ")}`,
    detail: `New depreciation_flags in window ${windowStart}..${asOf}:\n${lines.join("\n")}`,
    data: { tickers, rows: relevant },
  };
}

// ---------------------------------------------------------------------------
// Check 2: AIQ drift > 10 pts
// ---------------------------------------------------------------------------

function checkAiqDrift(aiqByTicker: Map<string, AiqRubricSnap[]>): Finding {
  const drifts: Array<{ ticker: string; latest: AiqRubricSnap; prior: AiqRubricSnap; delta: number }> = [];
  for (const [ticker, rows] of aiqByTicker) {
    if (rows.length < 2) continue;
    const latest = rows[0];
    const prior = rows[1];
    if (latest.total == null || prior.total == null) continue;
    const delta = latest.total - prior.total;
    if (Math.abs(delta) > AIQ_DRIFT_THRESHOLD) {
      drifts.push({ ticker, latest, prior, delta });
    }
  }
  if (drifts.length === 0) {
    return {
      check_id: "aiq_drift",
      severity: "info",
      summary: "No AIQ rubric drifts > 10 pts since prior rubric.",
      detail: `Scanned ${aiqByTicker.size} tickers with ≥2 rubric snapshots. Threshold |Δ| > ${AIQ_DRIFT_THRESHOLD}.`,
      data: { tickers: [] },
    };
  }
  drifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const lines = drifts.map(
    (d) =>
      `  • ${d.ticker}: ${d.prior.total} (${d.prior.scored_at}) → ${d.latest.total} (${d.latest.scored_at}) [Δ ${d.delta > 0 ? "+" : ""}${d.delta}]`,
  );
  return {
    check_id: "aiq_drift",
    severity: "warn",
    summary: `${drifts.length} ticker(s) with AIQ drift > ${AIQ_DRIFT_THRESHOLD}pt: ${drifts.map((d) => d.ticker).join(", ")}`,
    detail: `AIQ rubric drift since prior snapshot (latest vs prior):\n${lines.join("\n")}`,
    data: {
      drifts: drifts.map((d) => ({
        ticker: d.ticker,
        prior_total: d.prior.total,
        prior_scored_at: d.prior.scored_at,
        latest_total: d.latest.total,
        latest_scored_at: d.latest.scored_at,
        delta: d.delta,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Check 3: hyperscaler pairwise correlation movement > 0.20
// ---------------------------------------------------------------------------

function checkHyperscalerCorrelation(window: HyperscalerReturnsWindow): Finding {
  const tickers = Array.from(window.current.keys())
    .filter((t) => window.prior.has(t))
    .sort();
  if (tickers.length < 2) {
    return {
      check_id: "hyperscaler_correlation",
      severity: "data_gap",
      summary: "Not enough hyperscalers with coverage in both windows.",
      detail: `Found ${tickers.length} hyperscalers with returns in both current and prior windows. Need ≥2.`,
      data: { tickers_covered: tickers },
    };
  }
  const moves: Array<{ a: string; b: string; current: number; prior: number; delta: number }> = [];
  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const a = tickers[i];
      const b = tickers[j];
      const curA = window.current.get(a)!;
      const curB = window.current.get(b)!;
      const prA = window.prior.get(a)!;
      const prB = window.prior.get(b)!;
      const curCorr = pearson(curA, curB);
      const priorCorr = pearson(prA, prB);
      if (curCorr == null || priorCorr == null) continue;
      const delta = curCorr - priorCorr;
      if (Math.abs(delta) > HYPERSCALER_CORR_DELTA_THRESHOLD) {
        moves.push({ a, b, current: curCorr, prior: priorCorr, delta });
      }
    }
  }
  if (moves.length === 0) {
    return {
      check_id: "hyperscaler_correlation",
      severity: "info",
      summary: `No hyperscaler pair correlations moved > ${HYPERSCALER_CORR_DELTA_THRESHOLD}.`,
      detail: `Compared ${tickers.length} hyperscalers across ${(tickers.length * (tickers.length - 1)) / 2} pairs.`,
      data: { tickers, pair_count: (tickers.length * (tickers.length - 1)) / 2 },
    };
  }
  moves.sort((m1, m2) => Math.abs(m2.delta) - Math.abs(m1.delta));
  const lines = moves.map(
    (m) =>
      `  • ${m.a} × ${m.b}: ${m.prior.toFixed(2)} → ${m.current.toFixed(2)} [Δ ${m.delta > 0 ? "+" : ""}${m.delta.toFixed(2)}]`,
  );
  return {
    check_id: "hyperscaler_correlation",
    severity: "warn",
    summary: `${moves.length} hyperscaler pair(s) moved > ${HYPERSCALER_CORR_DELTA_THRESHOLD} in correlation.`,
    detail: `Pairwise correlation deltas (current 90d vs prior 90d):\n${lines.join("\n")}`,
    data: { moves },
  };
}

// ---------------------------------------------------------------------------
// Check 4: consensus 2026/2027 capex movement > 10% (data gap)
// ---------------------------------------------------------------------------

function checkConsensusCapex(snaps: CapexSnap[]): Finding {
  // Trailing-indicator approximation of a leading-indicator signal.
  // Spec calls for forward consensus capex estimates (FY1/FY2); the
  // consensus table only carries EPS + rating today. We surface
  // hyperscaler trailing-12mo capex YoY deltas as the closest proxy
  // and tag as data_gap so the operator knows the spec'd check is
  // NOT the one actually firing. See docs/PARKED.md item 2 — parked
  // pending evidence the TTM proxy misses material inflections.
  const observable: Array<{ ticker: string; pct: number; current: number; prior: number }> = [];
  for (const s of snaps) {
    if (s.current_ttm_capex == null || s.prior_ttm_capex == null) continue;
    if (s.prior_ttm_capex === 0) continue;
    const pct = ((s.current_ttm_capex - s.prior_ttm_capex) / Math.abs(s.prior_ttm_capex)) * 100;
    observable.push({ ticker: s.ticker, pct, current: s.current_ttm_capex, prior: s.prior_ttm_capex });
  }
  observable.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const flagged = observable.filter((o) => Math.abs(o.pct) > CAPEX_DELTA_THRESHOLD_PCT);
  const lines = observable.map(
    (o) =>
      `  • ${o.ticker}: TTM capex ${o.prior.toFixed(0)} → ${o.current.toFixed(0)} [${o.pct > 0 ? "+" : ""}${o.pct.toFixed(1)}%]`,
  );
  const detail =
    `Spec calls for consensus 2026/2027 capex deltas; the consensus table does not currently store capex estimates (only EPS / rating). ` +
    `Surfacing trailing-12mo capex YoY deltas as the closest observable proxy. Add capex_fy1/fy2 to consensus to fire the spec check.\n` +
    (lines.length > 0 ? `Trailing-12mo capex YoY:\n${lines.join("\n")}` : "No trailing-12mo capex coverage in current snapshot.");
  return {
    check_id: "consensus_capex",
    severity: "data_gap",
    summary:
      flagged.length > 0
        ? `Trailing-12mo capex proxy: ${flagged.length} hyperscaler(s) moved > ${CAPEX_DELTA_THRESHOLD_PCT}% YoY. Consensus capex column not yet ingested.`
        : "Consensus capex column not yet ingested. Trailing-12mo capex proxy stable.",
    detail,
    data: { observable, flagged, threshold_pct: CAPEX_DELTA_THRESHOLD_PCT },
  };
}

// ---------------------------------------------------------------------------
// Check 5: annual walk-forward re-optimize trigger
// ---------------------------------------------------------------------------

function checkAnnualWalkForward(asOf: string): Finding {
  return {
    check_id: "annual_walk_forward",
    severity: "warn",
    summary: "Annual walk-forward re-optimization due.",
    detail: `Q1 review ${asOf} — re-run the THS-64 backtest harness across the prior 5y window with current parameters, compare Sharpe / hit-rate to last year's calibration, and adjust top-N or cost assumptions if they've drifted materially.`,
    data: { as_of: asOf },
  };
}

// ---------------------------------------------------------------------------
// Pearson correlation (truncates to shortest length).
// ---------------------------------------------------------------------------

function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dxx = 0;
  let dyy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dxx += dx * dx;
    dyy += dy * dy;
  }
  if (dxx === 0 || dyy === 0) return null;
  return num / Math.sqrt(dxx * dyy);
}

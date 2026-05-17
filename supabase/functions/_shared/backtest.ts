// THS-64 (E6.2) — Walk-forward backtest engine.
//
// Pure helper — no DB, no SDK imports. The caller assembles the
// observation matrix (per ticker × date scores + returns) and hands
// it to `runBacktest`. The engine selects top-N by composite score at
// each rebalance date, holds equal-weighted until next rebalance,
// applies one-way costs per turnover, and produces summary metrics.
//
// Lookahead-safe contract: at rebalance date `t`, the engine uses only
// scores from `as_of <= t - lag_days`, then earns returns from `t` to
// the next rebalance. Lagging is the caller's responsibility on the
// input side (they pass us scored_at) — but `runBacktest` enforces by
// rejecting scores with `as_of > rebalance_date`.
//
// Spec: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §Part 4 (engine
// build plan) — walk-forward monthly rebalance, 5y window, 10bps
// each-side costs, output Sharpe / max DD / hit rate / turnover.
//
// Sharpe annualization is 12 (monthly returns × √12) since the engine
// trades on a monthly cadence.

export interface ScoreObs {
  /** Rebalance date or any prior date. */
  as_of: string;
  ticker: string;
  score: number | null;
}

export interface ReturnObs {
  /** Period-end date (matches the rebalance date that ENDS the period). */
  as_of: string;
  ticker: string;
  /** Return over the period ending at as_of, as a decimal (e.g. 0.04 = +4%). */
  ret: number | null;
}

export interface BacktestConfig {
  /** Rebalance dates in chronological order. */
  rebalanceDates: ReadonlyArray<string>;
  /** Number of names to hold (equal-weighted) each period. */
  topN: number;
  /** One-way transaction cost in decimal (10 bps = 0.001). */
  costPerSide: number;
  /** Returns are monthly by default; override for weekly etc. */
  periodsPerYear?: number;
}

export interface BacktestResult {
  monthly_returns: number[];        // gross of cost (informational)
  monthly_returns_net: number[];    // net of cost
  turnover_series: number[];        // 0..2 (sum of |new - old| weights)
  total_return: number;
  sharpe: number;                   // annualized, net of cost
  max_drawdown: number;             // worst peak-to-trough
  hit_rate: number;                 // % of months with positive net return
  avg_turnover: number;
  rebalance_count: number;
}

/**
 * Walk-forward backtest. Returns metrics; caller persists / renders.
 */
export function runBacktest(
  scores: ReadonlyArray<ScoreObs>,
  returns: ReadonlyArray<ReturnObs>,
  cfg: BacktestConfig,
): BacktestResult {
  const dates = cfg.rebalanceDates.slice().sort();
  if (dates.length < 2) {
    return emptyResult();
  }

  // Index returns by (date, ticker) for O(1) lookup at each rebalance.
  const retIdx = new Map<string, number>();
  for (const r of returns) {
    if (r.ret == null || !Number.isFinite(r.ret)) continue;
    retIdx.set(`${r.as_of}|${r.ticker}`, r.ret);
  }

  // Index scores by date for O(N_universe) per period.
  const scoresByDate = new Map<string, ScoreObs[]>();
  for (const s of scores) {
    if (s.score == null || !Number.isFinite(s.score)) continue;
    const arr = scoresByDate.get(s.as_of);
    if (arr) arr.push(s);
    else scoresByDate.set(s.as_of, [s]);
  }

  const monthlyReturns: number[] = [];
  const monthlyReturnsNet: number[] = [];
  const turnoverSeries: number[] = [];
  let prevWeights = new Map<string, number>();

  for (let i = 0; i < dates.length - 1; i++) {
    const rebDate = dates[i];
    const endDate = dates[i + 1];

    // Score snapshot at or just before rebDate. We allow any prior as_of
    // ≤ rebDate (look-back is bounded by caller via supplying only
    // recent enough scores).
    const candidates: ScoreObs[] = [];
    for (const [d, arr] of scoresByDate) {
      if (d > rebDate) continue;
      for (const s of arr) candidates.push(s);
    }
    // Collapse to one observation per ticker — most recent as_of wins.
    const latestByTicker = new Map<string, ScoreObs>();
    for (const c of candidates) {
      const prev = latestByTicker.get(c.ticker);
      if (!prev || c.as_of > prev.as_of) latestByTicker.set(c.ticker, c);
    }
    const sorted = Array.from(latestByTicker.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const top = sorted.slice(0, cfg.topN);
    if (top.length === 0) {
      // No tradeable book this period — flat return.
      monthlyReturns.push(0);
      monthlyReturnsNet.push(0);
      turnoverSeries.push(0);
      prevWeights = new Map();
      continue;
    }

    const w = 1 / top.length;
    const newWeights = new Map<string, number>();
    for (const t of top) newWeights.set(t.ticker, w);

    // Turnover = sum of |new - old| (range [0, 2]).
    let turnover = 0;
    const allTickers = new Set([...prevWeights.keys(), ...newWeights.keys()]);
    for (const t of allTickers) {
      turnover += Math.abs((newWeights.get(t) ?? 0) - (prevWeights.get(t) ?? 0));
    }
    const cost = turnover * cfg.costPerSide;

    // Period return: equal-weighted return on the held basket from
    // rebDate to endDate. The ReturnObs.as_of stamp = endDate.
    let gross = 0;
    let covered = 0;
    for (const t of top) {
      const r = retIdx.get(`${endDate}|${t.ticker}`);
      if (r == null) continue;
      gross += w * r;
      covered++;
    }
    // If coverage is partial, scale up so the held basket return is the
    // mean of available returns (not dragged toward 0 by missing data).
    if (covered > 0 && covered < top.length) {
      gross = gross * (top.length / covered);
    }
    monthlyReturns.push(gross);
    monthlyReturnsNet.push(gross - cost);
    turnoverSeries.push(turnover);
    prevWeights = newWeights;
  }

  return summarize(monthlyReturns, monthlyReturnsNet, turnoverSeries, cfg.periodsPerYear ?? 12);
}

function summarize(
  monthlyReturns: number[],
  monthlyReturnsNet: number[],
  turnoverSeries: number[],
  periodsPerYear: number,
): BacktestResult {
  if (monthlyReturnsNet.length === 0) return emptyResult();

  let totalReturn = 1;
  for (const r of monthlyReturnsNet) totalReturn *= 1 + r;
  totalReturn -= 1;

  const meanNet = mean(monthlyReturnsNet);
  const stdNet = stddev(monthlyReturnsNet);
  const sharpe = stdNet === 0 ? 0 : (meanNet * periodsPerYear) / (stdNet * Math.sqrt(periodsPerYear));

  // Max drawdown on the cumulative-return curve.
  let peak = 1;
  let cum = 1;
  let maxDd = 0;
  for (const r of monthlyReturnsNet) {
    cum *= 1 + r;
    if (cum > peak) peak = cum;
    const dd = cum / peak - 1;
    if (dd < maxDd) maxDd = dd;
  }

  let positives = 0;
  for (const r of monthlyReturnsNet) if (r > 0) positives++;
  const hitRate = positives / monthlyReturnsNet.length;
  const avgTurnover = mean(turnoverSeries);

  return {
    monthly_returns: monthlyReturns,
    monthly_returns_net: monthlyReturnsNet,
    turnover_series: turnoverSeries,
    total_return: totalReturn,
    sharpe,
    max_drawdown: maxDd,
    hit_rate: hitRate,
    avg_turnover: avgTurnover,
    rebalance_count: monthlyReturnsNet.length,
  };
}

function mean(xs: ReadonlyArray<number>): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function stddev(xs: ReadonlyArray<number>): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let ss = 0;
  for (const x of xs) ss += (x - m) * (x - m);
  return Math.sqrt(ss / (xs.length - 1));
}

function emptyResult(): BacktestResult {
  return {
    monthly_returns: [],
    monthly_returns_net: [],
    turnover_series: [],
    total_return: 0,
    sharpe: 0,
    max_drawdown: 0,
    hit_rate: 0,
    avg_turnover: 0,
    rebalance_count: 0,
  };
}

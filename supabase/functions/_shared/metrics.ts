// Per-ticker primitive ratios + time-series stats for the factor engine.
// Pure functions, no DB, no Supabase imports. The factor-q / factor-g /
// factor-v modules consume these and aggregate within layer cohorts.
//
// Returns `null` (not NaN) for "I cannot compute this from the inputs given"
// so callers can decide null-vs-drop downstream. NaN inside an array always
// means "missing data point" — the stats module filters those.

import { mean, stddev } from "./stats.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

// A subset of fundamentals_raw shaped by what each ratio actually reads.
// Importing the full `FundamentalsRow` from fmp.ts would pull a Deno-flavored
// dep chain into a pure math module; keep this self-contained.
export interface Fundamentals {
  revenue: number | null;
  gross_profit: number | null;
  operating_income: number | null;
  net_income: number | null;
  fcf: number | null;
  total_assets: number | null;
  total_debt: number | null;
  shareholders_equity: number | null;
  shares_diluted: number | null;
  cash_and_equivalents: number | null;
  retained_earnings: number | null;
  current_assets: number | null;
  current_liabilities: number | null;
  income_before_tax: number | null;
  income_tax_expense: number | null;
  dividends_paid: number | null;
  common_stock_repurchased: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

// Safe division: null in → null out, zero denominator → null.
function safeDiv(num: number | null, den: number | null): number | null {
  if (!isFiniteNumber(num) || !isFiniteNumber(den) || den === 0) return null;
  return num / den;
}

// ─── Profitability primitives ────────────────────────────────────────────────

export function grossProfitOverAssets(f: Fundamentals): number | null {
  return safeDiv(f.gross_profit, f.total_assets);
}

export function operatingMargin(f: Fundamentals): number | null {
  return safeDiv(f.operating_income, f.revenue);
}

export function fcfOverRevenue(f: Fundamentals): number | null {
  return safeDiv(f.fcf, f.revenue);
}

/**
 * Effective tax rate from income statement. Clamped to [0, 0.5] so a
 * one-off tax benefit (negative tax expense) or a 100%+ effective rate
 * (loss-year with discrete charges) doesn't poison NOPAT.
 * Returns null if income_before_tax ≤ 0 (loss-year — NOPAT isn't a useful
 * profitability signal in that regime; let the metric drop out).
 */
export function effectiveTaxRate(f: Fundamentals): number | null {
  if (!isFiniteNumber(f.income_before_tax) || f.income_before_tax <= 0) return null;
  if (!isFiniteNumber(f.income_tax_expense)) return null;
  const rate = f.income_tax_expense / f.income_before_tax;
  if (rate < 0) return 0;
  if (rate > 0.5) return 0.5;
  return rate;
}

/**
 * ROIC = NOPAT / invested_capital.
 *   NOPAT = operating_income × (1 − effective_tax_rate)
 *   invested_capital = total_debt + shareholders_equity − cash_and_equivalents
 * Returns null if any required input is missing or invested_capital ≤ 0.
 */
export function roic(f: Fundamentals): number | null {
  if (!isFiniteNumber(f.operating_income)) return null;
  const tax = effectiveTaxRate(f);
  if (tax === null) return null;
  const nopat = f.operating_income * (1 - tax);
  const totalDebt = isFiniteNumber(f.total_debt) ? f.total_debt : 0;
  const equity = isFiniteNumber(f.shareholders_equity) ? f.shareholders_equity : null;
  if (equity === null) return null;
  const cash = isFiniteNumber(f.cash_and_equivalents) ? f.cash_and_equivalents : 0;
  const investedCapital = totalDebt + equity - cash;
  if (investedCapital <= 0) return null;
  return nopat / investedCapital;
}

// ─── Safety primitives ───────────────────────────────────────────────────────

/**
 * Debt-to-equity. Both inputs come from latest balance sheet. Negative
 * equity (rare in this universe — buybacks-funded balance sheets) yields
 * null because D/E semantics break down.
 */
export function leverage(f: Fundamentals): number | null {
  if (!isFiniteNumber(f.total_debt) || !isFiniteNumber(f.shareholders_equity)) return null;
  if (f.shareholders_equity <= 0) return null;
  return f.total_debt / f.shareholders_equity;
}

/**
 * Altman Z-score, public-company manufacturing form:
 *   1.2 × (working_capital / total_assets) +
 *   1.4 × (retained_earnings / total_assets) +
 *   3.3 × (EBIT / total_assets) +
 *   0.6 × (market_cap / total_liabilities) +
 *   1.0 × (revenue / total_assets)
 * EBIT is approximated as operating_income (close enough for this universe;
 * full reconciliation needs interest income/expense we don't ingest).
 * Total liabilities ≈ total_assets − shareholders_equity.
 * Higher = safer.
 */
export function altmanZ(f: Fundamentals, marketCap: number | null): number | null {
  if (!isFiniteNumber(f.total_assets) || f.total_assets <= 0) return null;
  if (!isFiniteNumber(f.current_assets) || !isFiniteNumber(f.current_liabilities)) return null;
  if (!isFiniteNumber(f.retained_earnings)) return null;
  if (!isFiniteNumber(f.operating_income)) return null;
  if (!isFiniteNumber(f.revenue)) return null;
  if (!isFiniteNumber(f.shareholders_equity)) return null;
  if (!isFiniteNumber(marketCap) || marketCap <= 0) return null;

  const workingCapital = f.current_assets - f.current_liabilities;
  const totalLiabilities = f.total_assets - f.shareholders_equity;
  if (totalLiabilities <= 0) return null;

  return (
    1.2 * (workingCapital / f.total_assets) +
    1.4 * (f.retained_earnings / f.total_assets) +
    3.3 * (f.operating_income / f.total_assets) +
    0.6 * (marketCap / totalLiabilities) +
    1.0 * (f.revenue / f.total_assets)
  );
}

/**
 * EPS volatility = stddev of trailing EPS series. Caller provides EPS values
 * already computed (e.g. net_income / shares_diluted per quarter); this just
 * runs the std. Returns null if fewer than 4 finite points (a year of data).
 */
export function epsVolatility(epsSeries: ReadonlyArray<number | null>): number | null {
  const finite: number[] = [];
  for (const v of epsSeries) if (isFiniteNumber(v)) finite.push(v);
  if (finite.length < 4) return null;
  return stddev(finite);
}

/**
 * Helper: build an EPS series from parallel net_income + shares_diluted
 * arrays. Returns null for any period missing either input.
 */
export function epsSeriesFromFundamentals(
  history: ReadonlyArray<Pick<Fundamentals, "net_income" | "shares_diluted">>,
): Array<number | null> {
  return history.map((row) => safeDiv(row.net_income, row.shares_diluted));
}

/**
 * Ordinary-least-squares beta of `own` returns against `benchmark` returns.
 * Both arrays must be the same length and aligned by date. Returns null if
 * fewer than 20 paired observations or if benchmark variance is 0.
 *
 * beta = cov(own, bench) / var(bench)
 */
export function beta(
  own: ReadonlyArray<number | null>,
  benchmark: ReadonlyArray<number | null>,
): number | null {
  if (own.length !== benchmark.length) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < own.length; i++) {
    const o = own[i];
    const b = benchmark[i];
    if (isFiniteNumber(o) && isFiniteNumber(b)) {
      xs.push(b);
      ys.push(o);
    }
  }
  if (xs.length < 20) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let covSum = 0;
  let varSum = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    covSum += dx * (ys[i] - my);
    varSum += dx * dx;
  }
  if (varSum === 0) return null;
  return covSum / varSum;
}

/**
 * Daily simple returns from an aligned close-price series (oldest first).
 * Output length = input length − 1. Any null or zero base price yields a
 * null at that index so beta() can filter it.
 */
export function dailyReturns(closes: ReadonlyArray<number | null>): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (!isFiniteNumber(prev) || !isFiniteNumber(cur) || prev === 0) {
      out.push(null);
    } else {
      out.push(cur / prev - 1);
    }
  }
  return out;
}

// ─── Payout primitives ───────────────────────────────────────────────────────

/**
 * Payout yield = (dividends + buybacks) / market_cap.
 * Both cash-flow components are positive magnitudes per our storage
 * convention (FMP returns negative; mergeStatements applies abs()).
 * Returns null on missing market cap. Missing components default to 0 only
 * when at least one component is finite — if BOTH are missing, returns null
 * so we don't claim a 0% yield for a ticker we have no data on.
 */
export function payoutYield(f: Fundamentals, marketCap: number | null): number | null {
  if (!isFiniteNumber(marketCap) || marketCap <= 0) return null;
  const div = isFiniteNumber(f.dividends_paid) ? f.dividends_paid : null;
  const buyback = isFiniteNumber(f.common_stock_repurchased) ? f.common_stock_repurchased : null;
  if (div === null && buyback === null) return null;
  return ((div ?? 0) + (buyback ?? 0)) / marketCap;
}

// ─── 5y delta (growth pillar) ────────────────────────────────────────────────

/**
 * 5y change in a profitability ratio: current_value − value_5y_ago.
 * Inputs are values computed at each annual period_end, oldest first. Needs
 * at least 5 finite annual data points (use index 0 as "5y ago" and the
 * last as "current"). Returns null if either endpoint is missing or fewer
 * than 5 periods provided.
 */
export function fiveYearDelta(annualValues: ReadonlyArray<number | null>): number | null {
  if (annualValues.length < 5) return null;
  const current = annualValues[annualValues.length - 1];
  const fiveAgo = annualValues[annualValues.length - 5];
  if (!isFiniteNumber(current) || !isFiniteNumber(fiveAgo)) return null;
  return current - fiveAgo;
}

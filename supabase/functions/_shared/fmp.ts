// FMP (Financial Modeling Prep) client + normalization for our fundamentals
// schema. Pure helpers (`normalizeFundamentals`, `mergeStatements`) are
// import-safe in both Deno and Node so they can be unit-tested locally.

import { requireEnv } from "./env.ts";

export type Period = "Q" | "A";

export interface FundamentalsRow {
  ticker: string;
  period_end: string;            // ISO YYYY-MM-DD
  period_type: Period;
  revenue: number | null;
  gross_profit: number | null;
  operating_income: number | null;
  net_income: number | null;
  fcf: number | null;
  total_assets: number | null;
  total_debt: number | null;
  shareholders_equity: number | null;
  capex: number | null;
  shares_diluted: number | null;
  // THS-41 additions — QMJ Q-score support fields.
  cash_and_equivalents: number | null;
  retained_earnings: number | null;
  current_assets: number | null;
  current_liabilities: number | null;
  income_before_tax: number | null;
  income_tax_expense: number | null;
  dividends_paid: number | null;          // positive magnitude (cash outflow)
  common_stock_repurchased: number | null; // positive magnitude (cash outflow)
  r_and_d_expense: number | null;          // operating expense; positive
  depreciation_and_amortization: number | null; // positive magnitude
}

// ---------------------------------------------------------------------------
// FMP response shapes (loose — FMP fields drift, only declare what we read).
// ---------------------------------------------------------------------------
export interface FmpIncomeRow {
  date: string;
  symbol: string;
  revenue?: number | null;
  grossProfit?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
  incomeBeforeTax?: number | null;
  incomeTaxExpense?: number | null;
  researchAndDevelopmentExpenses?: number | null;
  depreciationAndAmortization?: number | null;
  weightedAverageShsOutDil?: number | null;
}

export interface FmpBalanceRow {
  date: string;
  symbol: string;
  totalAssets?: number | null;
  totalDebt?: number | null;
  totalStockholdersEquity?: number | null;
  cashAndCashEquivalents?: number | null;
  retainedEarnings?: number | null;
  totalCurrentAssets?: number | null;
  totalCurrentLiabilities?: number | null;
}

export interface FmpCashRow {
  date: string;
  symbol: string;
  freeCashFlow?: number | null;
  capitalExpenditure?: number | null;
  dividendsPaid?: number | null;             // FMP returns negative (outflow)
  commonStockRepurchased?: number | null;    // FMP returns negative (outflow)
}

// FMP migrated to /stable/ in 2025; /api/v3/ is legacy and not available on
// new accounts. Symbol is a query parameter on every /stable/ endpoint, not
// a path segment.
const FMP_BASE = "https://financialmodelingprep.com/stable";

function fmpPeriod(period: Period): "quarter" | "annual" {
  return period === "Q" ? "quarter" : "annual";
}

async function fmpGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = requireEnv("FMP_API_KEY");
  const url = new URL(`${FMP_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FMP ${path} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function fetchIncome(ticker: string, period: Period, limit: number) {
  return fmpGet<FmpIncomeRow[]>(`/income-statement`, {
    symbol: ticker,
    period: fmpPeriod(period),
    limit: String(limit),
  });
}

export async function fetchBalance(ticker: string, period: Period, limit: number) {
  return fmpGet<FmpBalanceRow[]>(`/balance-sheet-statement`, {
    symbol: ticker,
    period: fmpPeriod(period),
    limit: String(limit),
  });
}

export async function fetchCash(ticker: string, period: Period, limit: number) {
  return fmpGet<FmpCashRow[]>(`/cash-flow-statement`, {
    symbol: ticker,
    period: fmpPeriod(period),
    limit: String(limit),
  });
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested).
// ---------------------------------------------------------------------------

function asNum(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !isFinite(v)) return null;
  return v;
}

/**
 * Merge income / balance / cash statements (keyed on `date`) into the
 * fundamentals_raw row shape. FMP returns separate calls per statement so we
 * join them ourselves. Returns one row per `date` present in income (income
 * is treated as the authoritative period list).
 */
export function mergeStatements(
  ticker: string,
  period: Period,
  income: FmpIncomeRow[],
  balance: FmpBalanceRow[],
  cash: FmpCashRow[],
): FundamentalsRow[] {
  const balanceByDate = new Map(balance.map((r) => [r.date, r]));
  const cashByDate = new Map(cash.map((r) => [r.date, r]));

  return income.map((inc) => {
    const bal = balanceByDate.get(inc.date);
    const cf = cashByDate.get(inc.date);
    return {
      ticker,
      period_end: inc.date,
      period_type: period,
      revenue: asNum(inc.revenue),
      gross_profit: asNum(inc.grossProfit),
      operating_income: asNum(inc.operatingIncome),
      net_income: asNum(inc.netIncome),
      fcf: asNum(cf?.freeCashFlow),
      total_assets: asNum(bal?.totalAssets),
      total_debt: asNum(bal?.totalDebt),
      shareholders_equity: asNum(bal?.totalStockholdersEquity),
      // FMP returns capex as a negative number (cash outflow). Store the
      // magnitude so downstream factor math doesn't have to remember the sign.
      capex: cf?.capitalExpenditure == null ? null : Math.abs(cf.capitalExpenditure),
      shares_diluted: asNum(inc.weightedAverageShsOutDil),
      // THS-41 QMJ-support fields.
      cash_and_equivalents: asNum(bal?.cashAndCashEquivalents),
      retained_earnings: asNum(bal?.retainedEarnings),
      current_assets: asNum(bal?.totalCurrentAssets),
      current_liabilities: asNum(bal?.totalCurrentLiabilities),
      income_before_tax: asNum(inc.incomeBeforeTax),
      income_tax_expense: asNum(inc.incomeTaxExpense),
      // Cash outflows: FMP returns negative, we store positive magnitudes.
      dividends_paid: cf?.dividendsPaid == null
        ? null
        : Math.abs(cf.dividendsPaid),
      common_stock_repurchased: cf?.commonStockRepurchased == null
        ? null
        : Math.abs(cf.commonStockRepurchased),
      r_and_d_expense: asNum(inc.researchAndDevelopmentExpenses),
      depreciation_and_amortization: asNum(inc.depreciationAndAmortization),
    };
  });
}

// ---------------------------------------------------------------------------
// Consensus / estimates (THS-39)
// ---------------------------------------------------------------------------

export interface ConsensusRow {
  ticker: string;
  as_of: string;             // ISO YYYY-MM-DD
  ntm_revenue: number | null;
  ntm_eps: number | null;
  fy1_eps: number | null;
  fy2_eps: number | null;
  num_analysts: number | null;
  rating_avg: number | null; // spec convention: 1 strong buy, 5 strong sell
  target_price: number | null;
}

export interface FmpAnalystEstimateRow {
  date: string;
  symbol: string;
  estimatedRevenueAvg?: number | null;
  estimatedEpsAvg?: number | null;
  numberAnalystsEstimatedRevenue?: number | null;
  numberAnalystsEstimatedEps?: number | null;
}

export interface FmpPriceTargetConsensus {
  symbol: string;
  targetHigh?: number | null;
  targetLow?: number | null;
  targetConsensus?: number | null;
  targetMedian?: number | null;
}

export interface FmpRatingRow {
  symbol: string;
  date?: string;
  // FMP's /stable/ratings-snapshot returns a quantitative rating. Field names
  // weren't fully verified from the docs in this iteration — we read the most
  // likely candidates and fall back to null. Legacy /api/v3/rating used
  // `ratingScore` on a 1=sell..5=buy scale.
  ratingScore?: number | null;
  overallScore?: number | null;
  rating?: number | null;
  ratingRecommendation?: string | null;
}

export async function fetchAnalystEstimates(ticker: string, limit = 4) {
  return fmpGet<FmpAnalystEstimateRow[]>(`/analyst-estimates`, {
    symbol: ticker,
    period: "annual",
    limit: String(limit),
  });
}

export async function fetchPriceTargetConsensus(ticker: string) {
  const arr = await fmpGet<FmpPriceTargetConsensus[]>(`/price-target-consensus`, {
    symbol: ticker,
  });
  return arr[0] ?? null;
}

export async function fetchRatingSnapshot(ticker: string) {
  const arr = await fmpGet<FmpRatingRow[]>(`/ratings-snapshot`, { symbol: ticker });
  return arr[0] ?? null;
}

/** @deprecated use fetchRatingSnapshot. Kept temporarily so callers don't break mid-rename. */
export const fetchRatingConsensus = fetchRatingSnapshot;

/**
 * Pure helper: given an array of forward analyst estimates and a reference
 * date, return today's consensus row. The "FY1" estimate is the next fiscal
 * year-end strictly after `today`; FY2 is the one after. NTM EPS / revenue
 * are FY1 by default — a deliberate simplification documented in
 * docs/schema.md (the algorithm spec doesn't pin down a blend).
 */
export function buildConsensusRow(
  ticker: string,
  today: string,
  estimates: FmpAnalystEstimateRow[],
  target: FmpPriceTargetConsensus | null,
  rating: FmpRatingRow | null,
): ConsensusRow {
  const future = estimates
    .filter((e) => e.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const fy1 = future[0];
  const fy2 = future[1];

  const num_analysts = asNum(fy1?.numberAnalystsEstimatedEps)
    ?? asNum(fy1?.numberAnalystsEstimatedRevenue);

  // FMP's quantitative rating (legacy /api/v3/rating, current
  // /stable/ratings-snapshot) uses 1=sell..5=buy. The spec stores the inverse
  // (1=buy..5=sell), so flip the sign. We probe a few likely field names —
  // the new /stable/ endpoint hasn't been verified against a live response —
  // and fall back to null when the score is outside the 1..5 sanity band.
  let rating_avg: number | null = null;
  const score = asNum(rating?.ratingScore)
    ?? asNum(rating?.overallScore)
    ?? asNum(rating?.rating);
  if (score !== null && score >= 1 && score <= 5) rating_avg = 6 - score;

  return {
    ticker,
    as_of: today,
    ntm_revenue: asNum(fy1?.estimatedRevenueAvg),
    ntm_eps: asNum(fy1?.estimatedEpsAvg),
    fy1_eps: asNum(fy1?.estimatedEpsAvg),
    fy2_eps: asNum(fy2?.estimatedEpsAvg),
    num_analysts,
    rating_avg,
    target_price: asNum(target?.targetConsensus) ?? asNum(target?.targetMedian),
  };
}

// ---------------------------------------------------------------------------
// Daily OHLCV (THS-40)
// ---------------------------------------------------------------------------

export interface PriceRow {
  ticker: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

interface FmpHistoricalRow {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  adjClose?: number | null;
  volume?: number | null;
}

interface FmpHistoricalResponse {
  symbol?: string;
  historical?: FmpHistoricalRow[];
}

export async function fetchHistoricalPrices(
  ticker: string,
  from: string,
  to: string,
): Promise<PriceRow[]> {
  // /stable/historical-price-eod-full is the current endpoint. The legacy
  // /api/v3/historical-price-full wrapped rows in a `{ historical: [...] }`
  // envelope; the /stable/ form returns the array directly. Handle both
  // shapes so this works during the deprecation overlap window.
  const resp = await fmpGet<FmpHistoricalResponse | FmpHistoricalRow[]>(
    `/historical-price-eod-full`,
    { symbol: ticker, from, to },
  );
  const rows: FmpHistoricalRow[] = Array.isArray(resp)
    ? resp
    : (resp.historical ?? []);
  return rows.map((r) => ({
    ticker,
    date: r.date,
    open: asNum(r.open),
    high: asNum(r.high),
    low: asNum(r.low),
    // Prefer adjusted close so corp-action distortions don't break momentum.
    close: asNum(r.adjClose) ?? asNum(r.close),
    volume: r.volume == null ? null : Math.trunc(r.volume),
  }));
}

/**
 * Pulls Q+A statements for one ticker and returns merged fundamentals rows.
 * Period is determined by the (period, limit) tuples passed in.
 */
export async function fetchFundamentals(
  ticker: string,
  options: { quarters?: number; annuals?: number } = {},
): Promise<FundamentalsRow[]> {
  const quarters = options.quarters ?? 8;
  const annuals = options.annuals ?? 3;

  const [qInc, qBal, qCash, aInc, aBal, aCash] = await Promise.all([
    fetchIncome(ticker, "Q", quarters),
    fetchBalance(ticker, "Q", quarters),
    fetchCash(ticker, "Q", quarters),
    fetchIncome(ticker, "A", annuals),
    fetchBalance(ticker, "A", annuals),
    fetchCash(ticker, "A", annuals),
  ]);

  return [
    ...mergeStatements(ticker, "Q", qInc, qBal, qCash),
    ...mergeStatements(ticker, "A", aInc, aBal, aCash),
  ];
}

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
  weightedAverageShsOutDil?: number | null;
}

export interface FmpBalanceRow {
  date: string;
  symbol: string;
  totalAssets?: number | null;
  totalDebt?: number | null;
  totalStockholdersEquity?: number | null;
}

export interface FmpCashRow {
  date: string;
  symbol: string;
  freeCashFlow?: number | null;
  capitalExpenditure?: number | null;
}

const FMP_BASE = "https://financialmodelingprep.com/api/v3";

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
  return fmpGet<FmpIncomeRow[]>(`/income-statement/${ticker}`, {
    period: fmpPeriod(period),
    limit: String(limit),
  });
}

export async function fetchBalance(ticker: string, period: Period, limit: number) {
  return fmpGet<FmpBalanceRow[]>(`/balance-sheet-statement/${ticker}`, {
    period: fmpPeriod(period),
    limit: String(limit),
  });
}

export async function fetchCash(ticker: string, period: Period, limit: number) {
  return fmpGet<FmpCashRow[]>(`/cash-flow-statement/${ticker}`, {
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
    };
  });
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

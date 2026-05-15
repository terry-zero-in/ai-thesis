// Service-role Supabase client factory + shared query helpers for edge functions.
// Service role bypasses RLS, which is correct for ingestion + scoring jobs.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "./env.ts";
import { dailyReturns } from "./metrics.ts";
import type { Fundamentals } from "./metrics.ts";
import type { Layer, QInputs } from "./factor-q.ts";

export function serviceClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function activeTickers(
  client: SupabaseClient,
  options: { kind?: "investable" | "benchmark" | "all" } = {},
): Promise<string[]> {
  const kind = options.kind ?? "investable";
  let query = client.from("universe").select("ticker").eq("is_active", true);
  if (kind !== "all") query = query.eq("kind", kind);
  const { data, error } = await query.order("ticker");
  if (error) throw error;
  return (data ?? []).map((r) => r.ticker as string);
}

// ---------------------------------------------------------------------------
// Q-score cohort loading (THS-41). Builds the QInputs Map<ticker> across the
// full investable universe with five queries, grouped here so the edge
// function stays a thin orchestrator over the pure math.
// ---------------------------------------------------------------------------

type UniverseRow = { ticker: string; layer: number };

interface FundsRow extends Fundamentals {
  ticker: string;
  period_end: string;
}

interface PriceRow {
  ticker: string;
  date: string;
  close: number | null;
}

const FUNDS_COLUMNS = [
  "ticker",
  "period_end",
  "revenue",
  "gross_profit",
  "operating_income",
  "net_income",
  "fcf",
  "total_assets",
  "total_debt",
  "shareholders_equity",
  "shares_diluted",
  "cash_and_equivalents",
  "retained_earnings",
  "current_assets",
  "current_liabilities",
  "income_before_tax",
  "income_tax_expense",
  "dividends_paid",
  "common_stock_repurchased",
].join(",");

/**
 * Bulk-load every input the Q-score needs for the investable universe at
 * `asOf`, grouped by layer. Five round-trips total.
 *
 * - latest quarterly fundamentals per ticker (current ratios)
 * - last 5 annuals per ticker (5y deltas for growth pillar)
 * - last 20 quarters per ticker (EPS volatility)
 * - last ~120 calendar days of own + benchmark closes (beta + market cap)
 * - universe (ticker → layer, filtered to investable + active)
 *
 * The returned map is keyed by layer; pass each layer's array straight into
 * `computeQForCohort`.
 */
export async function loadQInputsByLayer(
  client: SupabaseClient,
  asOf: string,
  benchmark: string = "SPY",
  options: { quarterlyHistoryN?: number; annualHistoryN?: number; priceLookbackDays?: number } = {},
): Promise<Map<Layer, QInputs[]>> {
  const quartersN = options.quarterlyHistoryN ?? 20;
  const annualsN = options.annualHistoryN ?? 5;
  const priceLookback = options.priceLookbackDays ?? 120;

  // Universe.
  const univ = await client
    .from("universe")
    .select("ticker, layer")
    .eq("is_active", true)
    .eq("kind", "investable")
    .order("ticker");
  if (univ.error) throw univ.error;
  const universe = (univ.data ?? []) as UniverseRow[];
  const tickers = universe.map((u) => u.ticker);
  if (tickers.length === 0) return new Map();

  // Fundamentals (quarterly + annual) up to as_of. Single query each; pull
  // generously and we'll slice per-ticker in memory.
  const quarterlyCap = quartersN * 2; // safety margin for missing-period gaps
  const quarterlyTotalCap = tickers.length * quarterlyCap;
  const fundsQ = await client
    .from("fundamentals_raw")
    .select(FUNDS_COLUMNS)
    .eq("period_type", "Q")
    .lte("period_end", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("period_end", { ascending: false })
    .limit(quarterlyTotalCap);
  if (fundsQ.error) throw fundsQ.error;
  const quartersByTicker = groupByTicker((fundsQ.data ?? []) as FundsRow[], quartersN);

  const annualsTotalCap = tickers.length * (annualsN * 2);
  const fundsA = await client
    .from("fundamentals_raw")
    .select(FUNDS_COLUMNS)
    .eq("period_type", "A")
    .lte("period_end", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("period_end", { ascending: false })
    .limit(annualsTotalCap);
  if (fundsA.error) throw fundsA.error;
  const annualsByTicker = groupByTicker((fundsA.data ?? []) as FundsRow[], annualsN);

  // Prices: own + benchmark.
  const fromDate = isoDateMinusDays(asOf, priceLookback);
  const allTickersForPrices = [...tickers, benchmark];
  const prices = await client
    .from("prices_raw")
    .select("ticker, date, close")
    .gte("date", fromDate)
    .lte("date", asOf)
    .in("ticker", allTickersForPrices)
    .order("ticker")
    .order("date", { ascending: true });
  if (prices.error) throw prices.error;
  const pricesByTicker = new Map<string, PriceRow[]>();
  for (const row of (prices.data ?? []) as PriceRow[]) {
    const list = pricesByTicker.get(row.ticker) ?? [];
    list.push(row);
    pricesByTicker.set(row.ticker, list);
  }

  // Benchmark close map: date → close (used to align own returns).
  const benchRows = pricesByTicker.get(benchmark) ?? [];
  const benchByDate = new Map<string, number | null>();
  for (const r of benchRows) benchByDate.set(r.date, r.close);

  // Build QInputs per ticker.
  const byLayer = new Map<Layer, QInputs[]>();
  for (const u of universe) {
    const layer = u.layer as Layer;
    if (layer < 1 || layer > 5) continue; // skip benchmark layer 0 defensively

    const qHistory = (quartersByTicker.get(u.ticker) ?? []).slice().reverse(); // oldest first
    const annuals = (annualsByTicker.get(u.ticker) ?? []).slice().reverse();   // oldest first
    const current = qHistory[qHistory.length - 1] ?? null;

    // Returns: walk own closes; for each adjacent pair, also need benchmark
    // closes on the same two dates. Build aligned close arrays first, then
    // compute returns on each.
    const ownPrices = pricesByTicker.get(u.ticker) ?? [];
    const ownAligned: Array<number | null> = [];
    const benchAligned: Array<number | null> = [];
    for (const r of ownPrices) {
      const benchClose = benchByDate.get(r.date);
      // Only keep dates the benchmark also trades; otherwise the return pair
      // is unusable for beta.
      if (benchClose === undefined) continue;
      ownAligned.push(r.close);
      benchAligned.push(benchClose);
    }
    const ownReturns = dailyReturns(ownAligned);
    const benchReturns = dailyReturns(benchAligned);

    // Market cap = latest close × latest shares_diluted.
    const latestClose = ownPrices.length > 0 ? ownPrices[ownPrices.length - 1].close : null;
    const latestShares = current?.shares_diluted ?? null;
    const marketCap =
      latestClose !== null && latestShares !== null && latestShares > 0
        ? latestClose * latestShares
        : null;

    // If we have no current fundamentals row, build a stub so the math
    // gracefully drops the ticker rather than crashing.
    const inputs: QInputs = {
      ticker: u.ticker,
      layer,
      current: stripFundamentals(current),
      annuals: annuals.map(stripFundamentals),
      quarterlyHistory: qHistory.map((row) => ({
        net_income: row.net_income,
        shares_diluted: row.shares_diluted,
      })),
      returns: { own: ownReturns, benchmark: benchReturns },
      marketCap,
    };

    const list = byLayer.get(layer) ?? [];
    list.push(inputs);
    byLayer.set(layer, list);
  }

  return byLayer;
}

// Group FundsRow[] by ticker, keep the first N rows of each group (relies on
// the caller having ordered by period_end DESC inside each ticker block).
function groupByTicker(rows: FundsRow[], capPerTicker: number): Map<string, FundsRow[]> {
  const out = new Map<string, FundsRow[]>();
  for (const row of rows) {
    const list = out.get(row.ticker) ?? [];
    if (list.length < capPerTicker) list.push(row);
    out.set(row.ticker, list);
  }
  return out;
}

function stripFundamentals(row: FundsRow | null): Fundamentals {
  if (row === null) {
    return {
      revenue: null,
      gross_profit: null,
      operating_income: null,
      net_income: null,
      fcf: null,
      total_assets: null,
      total_debt: null,
      shareholders_equity: null,
      shares_diluted: null,
      cash_and_equivalents: null,
      retained_earnings: null,
      current_assets: null,
      current_liabilities: null,
      income_before_tax: null,
      income_tax_expense: null,
      dividends_paid: null,
      common_stock_repurchased: null,
    };
  }
  // Strip transport-only fields (ticker, period_end).
  const { ticker: _t, period_end: _p, ...rest } = row;
  return rest;
}

function isoDateMinusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

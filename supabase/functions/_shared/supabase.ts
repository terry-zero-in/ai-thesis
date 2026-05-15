// Service-role Supabase client factory + shared query helpers for edge functions.
// Service role bypasses RLS, which is correct for ingestion + scoring jobs.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "./env.ts";
import { dailyReturns } from "./metrics.ts";
import type { Fundamentals } from "./metrics.ts";
import type { Layer, QInputs } from "./factor-q.ts";
import type { GInputs } from "./factor-g.ts";
import type { VInputs } from "./factor-v.ts";

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

// ---------------------------------------------------------------------------
// G-score cohort loading (THS-42). Pulls 12 quarters of revenue/capex/
// operating_income/r_and_d_expense for TTM-now and TTM-lag1y aggregates,
// the latest consensus snapshot (for ntm_revenue), and the latest two
// ai_segment_overrides rows per ticker (for AI revenue YoY where the
// override carries it).
// ---------------------------------------------------------------------------

interface GFundsRow {
  ticker: string;
  period_end: string;
  revenue: number | null;
  capex: number | null;
  operating_income: number | null;
  r_and_d_expense: number | null;
}

interface ConsensusRow {
  ticker: string;
  as_of: string;
  ntm_revenue: number | null;
}

interface OverrideRow {
  ticker: string;
  period_end: string;
  ai_revenue: number | null;
}

const G_FUNDS_COLUMNS = "ticker, period_end, revenue, capex, operating_income, r_and_d_expense";

export async function loadGInputsByLayer(
  client: SupabaseClient,
  asOf: string,
  options: { quarterlyHistoryN?: number } = {},
): Promise<Map<Layer, GInputs[]>> {
  // 12 quarters by default — 4 for current TTM, 4 for lag1y TTM, plus 4
  // safety quarters so a missed report doesn't drop the lag1y window.
  const quartersN = options.quarterlyHistoryN ?? 12;

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

  // Fundamentals (12 most recent quarters per ticker, ordered newest first).
  const fundsRes = await client
    .from("fundamentals_raw")
    .select(G_FUNDS_COLUMNS)
    .eq("period_type", "Q")
    .lte("period_end", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("period_end", { ascending: false })
    .limit(tickers.length * quartersN);
  if (fundsRes.error) throw fundsRes.error;
  const fundsByTicker = new Map<string, GFundsRow[]>();
  for (const row of (fundsRes.data ?? []) as GFundsRow[]) {
    const list = fundsByTicker.get(row.ticker) ?? [];
    if (list.length < quartersN) list.push(row);
    fundsByTicker.set(row.ticker, list);
  }

  // Latest consensus per ticker. Pull a wide window then collapse in code.
  const consensusFrom = isoDateMinusDays(asOf, 35);
  const consensusRes = await client
    .from("consensus")
    .select("ticker, as_of, ntm_revenue")
    .gte("as_of", consensusFrom)
    .lte("as_of", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("as_of", { ascending: false });
  if (consensusRes.error) throw consensusRes.error;
  const consensusLatest = new Map<string, ConsensusRow>();
  for (const row of (consensusRes.data ?? []) as ConsensusRow[]) {
    if (!consensusLatest.has(row.ticker)) consensusLatest.set(row.ticker, row);
  }

  // ai_segment_overrides — all rows for our tickers up to as_of, newest first.
  const overridesRes = await client
    .from("ai_segment_overrides")
    .select("ticker, period_end, ai_revenue")
    .lte("period_end", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("period_end", { ascending: false });
  if (overridesRes.error) throw overridesRes.error;
  const overridesByTicker = new Map<string, OverrideRow[]>();
  for (const row of (overridesRes.data ?? []) as OverrideRow[]) {
    const list = overridesByTicker.get(row.ticker) ?? [];
    list.push(row);
    overridesByTicker.set(row.ticker, list);
  }

  // Build GInputs per ticker.
  const byLayer = new Map<Layer, GInputs[]>();
  for (const u of universe) {
    const layer = u.layer as Layer;
    if (layer < 1 || layer > 5) continue;

    const quarters = fundsByTicker.get(u.ticker) ?? []; // newest first
    const ttmNow = aggregateTTM(quarters.slice(0, 4));
    const ttmLag1y = aggregateTTM(quarters.slice(4, 8));

    const consensus = consensusLatest.get(u.ticker) ?? null;

    const overrides = overridesByTicker.get(u.ticker) ?? [];
    const overrideLatest = overrides[0] ?? null;
    // 1y-ago = the most recent override whose period_end is ≥ 270 days
    // before the latest override's period_end. Loose because companies
    // don't always report on the exact same calendar quarter.
    let overrideLag1y: OverrideRow | null = null;
    if (overrideLatest) {
      const target = isoDateMinusDays(overrideLatest.period_end, 270);
      for (const row of overrides) {
        if (row.period_end <= target) {
          overrideLag1y = row;
          break;
        }
      }
    }

    const inputs: GInputs = {
      ticker: u.ticker,
      layer,
      ttmRevenue: ttmNow.revenue,
      ttmCapex: ttmNow.capex,
      ttmOperatingIncome: ttmNow.operating_income,
      ttmRdExpense: ttmNow.r_and_d_expense,
      ttmRevenue_lag1y: ttmLag1y.revenue,
      ttmCapex_lag1y: ttmLag1y.capex,
      ntmRevenue: consensus?.ntm_revenue ?? null,
      aiRevenue_current: overrideLatest?.ai_revenue ?? null,
      aiRevenue_lag1y: overrideLag1y?.ai_revenue ?? null,
    };

    const list = byLayer.get(layer) ?? [];
    list.push(inputs);
    byLayer.set(layer, list);
  }

  return byLayer;
}

// Sum four quarterly rows into a TTM aggregate. Per-field policy: if all
// four are non-null sum them; if any are null return null for that field
// (rather than understate). Returns nulls when fewer than 4 rows provided.
function aggregateTTM(rows: ReadonlyArray<GFundsRow>): {
  revenue: number | null;
  capex: number | null;
  operating_income: number | null;
  r_and_d_expense: number | null;
} {
  if (rows.length < 4) {
    return { revenue: null, capex: null, operating_income: null, r_and_d_expense: null };
  }
  const sumOrNull = (key: keyof GFundsRow): number | null => {
    let total = 0;
    for (const r of rows) {
      const v = r[key];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      total += v;
    }
    return total;
  };
  return {
    revenue: sumOrNull("revenue"),
    capex: sumOrNull("capex"),
    operating_income: sumOrNull("operating_income"),
    r_and_d_expense: sumOrNull("r_and_d_expense"),
  };
}

// ---------------------------------------------------------------------------
// V-score cohort loading (THS-43). Six queries: universe, 12 trailing
// quarters of fundamentals (TTM aggregates + latest balance-sheet snapshot),
// latest consensus, latest close (for market cap), depreciation_flags, and
// the forward_pe_history matview slice.
// ---------------------------------------------------------------------------

interface VFundsRow {
  ticker: string;
  period_end: string;
  revenue: number | null;
  operating_income: number | null;
  fcf: number | null;
  capex: number | null;
  total_debt: number | null;
  cash_and_equivalents: number | null;
  shares_diluted: number | null;
  depreciation_and_amortization: number | null;
}

interface DepFlagRow {
  ticker: string;
  flagged_at: string;
  penalty_v: number | null;
}

interface PriceCloseRow {
  ticker: string;
  date: string;
  close: number | null;
}

interface ForwardPeRow {
  ticker: string;
  date: string;
  forward_pe: number | null;
}

const V_FUNDS_COLUMNS =
  "ticker, period_end, revenue, operating_income, fcf, capex, total_debt, " +
  "cash_and_equivalents, shares_diluted, depreciation_and_amortization";

export async function loadVInputsByLayer(
  client: SupabaseClient,
  asOf: string,
  options: { quarterlyHistoryN?: number; forwardPeWindowDays?: number } = {},
): Promise<Map<Layer, VInputs[]>> {
  const quartersN = options.quarterlyHistoryN ?? 12;
  // 5y trading days ≈ 1260, in calendar terms ≈ 1825 days. Pull 1900 to be safe.
  const pe5yWindow = options.forwardPeWindowDays ?? 1900;

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

  // Fundamentals (12 trailing quarters per ticker).
  const fundsRes = await client
    .from("fundamentals_raw")
    .select(V_FUNDS_COLUMNS)
    .eq("period_type", "Q")
    .lte("period_end", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("period_end", { ascending: false })
    .limit(tickers.length * quartersN);
  if (fundsRes.error) throw fundsRes.error;
  const fundsByTicker = new Map<string, VFundsRow[]>();
  for (const row of (fundsRes.data ?? []) as VFundsRow[]) {
    const list = fundsByTicker.get(row.ticker) ?? [];
    if (list.length < quartersN) list.push(row);
    fundsByTicker.set(row.ticker, list);
  }

  // Latest consensus per ticker.
  const consensusFrom = isoDateMinusDays(asOf, 35);
  const consensusRes = await client
    .from("consensus")
    .select("ticker, as_of, ntm_revenue")
    .gte("as_of", consensusFrom)
    .lte("as_of", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("as_of", { ascending: false });
  if (consensusRes.error) throw consensusRes.error;
  const consensusLatest = new Map<string, ConsensusRow>();
  for (const row of (consensusRes.data ?? []) as ConsensusRow[]) {
    if (!consensusLatest.has(row.ticker)) consensusLatest.set(row.ticker, row);
  }

  // Latest close per ticker (for market cap).
  const pricesFrom = isoDateMinusDays(asOf, 14);
  const pricesRes = await client
    .from("prices_raw")
    .select("ticker, date, close")
    .gte("date", pricesFrom)
    .lte("date", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("date", { ascending: false });
  if (pricesRes.error) throw pricesRes.error;
  const latestClose = new Map<string, PriceCloseRow>();
  for (const row of (pricesRes.data ?? []) as PriceCloseRow[]) {
    if (!latestClose.has(row.ticker)) latestClose.set(row.ticker, row);
  }

  // Depreciation flags — latest per ticker. The penalty IS the stored
  // value (already includes Burry adjustment per spec §Fix 5).
  const depFlagsRes = await client
    .from("depreciation_flags")
    .select("ticker, flagged_at, penalty_v")
    .lte("flagged_at", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("flagged_at", { ascending: false });
  if (depFlagsRes.error) throw depFlagsRes.error;
  const depFlagLatest = new Map<string, DepFlagRow>();
  for (const row of (depFlagsRes.data ?? []) as DepFlagRow[]) {
    if (!depFlagLatest.has(row.ticker)) depFlagLatest.set(row.ticker, row);
  }

  // Forward P/E history (5y window per ticker, newest first).
  const peFrom = isoDateMinusDays(asOf, pe5yWindow);
  const peRes = await client
    .from("forward_pe_history")
    .select("ticker, date, forward_pe")
    .gte("date", peFrom)
    .lte("date", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("date", { ascending: true });
  if (peRes.error) throw peRes.error;
  const peByTicker = new Map<string, ForwardPeRow[]>();
  for (const row of (peRes.data ?? []) as ForwardPeRow[]) {
    const list = peByTicker.get(row.ticker) ?? [];
    list.push(row);
    peByTicker.set(row.ticker, list);
  }

  // Build VInputs per ticker.
  const byLayer = new Map<Layer, VInputs[]>();
  for (const u of universe) {
    const layer = u.layer as Layer;
    if (layer < 1 || layer > 5) continue;

    const quarters = fundsByTicker.get(u.ticker) ?? []; // newest first
    const ttm = aggregateTTMv(quarters.slice(0, 4));
    const latestQ = quarters[0] ?? null;

    const consensus = consensusLatest.get(u.ticker) ?? null;

    const lastClose = latestClose.get(u.ticker)?.close ?? null;
    const sharesDiluted = latestQ?.shares_diluted ?? null;
    const marketCap = lastClose !== null && sharesDiluted !== null && sharesDiluted > 0
      ? lastClose * sharesDiluted
      : null;

    const depPenalty = depFlagLatest.get(u.ticker)?.penalty_v ?? 0;

    const peSeries = peByTicker.get(u.ticker) ?? [];
    const forwardPeToday = peSeries.length > 0 ? peSeries[peSeries.length - 1].forward_pe : null;
    const forwardPeHistory = peSeries.map((p) => p.forward_pe);

    const inputs: VInputs = {
      ticker: u.ticker,
      layer,
      ttmRevenue: ttm.revenue,
      ttmOperatingIncome: ttm.operating_income,
      ttmDepreciationAmortization: ttm.depreciation_and_amortization,
      ttmFcf: ttm.fcf,
      ttmCapex: ttm.capex,
      latestTotalDebt: latestQ?.total_debt ?? null,
      latestCash: latestQ?.cash_and_equivalents ?? null,
      marketCap,
      ntmRevenue: consensus?.ntm_revenue ?? null,
      forwardPeToday,
      forwardPeHistory,
      depreciationPenalty: depPenalty,
    };

    const list = byLayer.get(layer) ?? [];
    list.push(inputs);
    byLayer.set(layer, list);
  }

  return byLayer;
}

// Sum four quarterly rows for the V-side fundamentals shape.
function aggregateTTMv(rows: ReadonlyArray<VFundsRow>): {
  revenue: number | null;
  operating_income: number | null;
  fcf: number | null;
  capex: number | null;
  depreciation_and_amortization: number | null;
} {
  if (rows.length < 4) {
    return {
      revenue: null, operating_income: null, fcf: null, capex: null,
      depreciation_and_amortization: null,
    };
  }
  const sumOrNull = (key: keyof VFundsRow): number | null => {
    let total = 0;
    for (const r of rows) {
      const v = r[key];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      total += v;
    }
    return total;
  };
  return {
    revenue: sumOrNull("revenue"),
    operating_income: sumOrNull("operating_income"),
    fcf: sumOrNull("fcf"),
    capex: sumOrNull("capex"),
    depreciation_and_amortization: sumOrNull("depreciation_and_amortization"),
  };
}

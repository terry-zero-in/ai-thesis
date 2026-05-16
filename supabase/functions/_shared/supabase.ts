// Service-role Supabase client factory + shared query helpers for edge functions.
// Service role bypasses RLS, which is correct for ingestion + scoring jobs.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "./env.ts";
import { dailyReturns } from "./metrics.ts";
import type { Fundamentals } from "./metrics.ts";
import type { Layer, QInputs } from "./factor-q.ts";
import type { GInputs } from "./factor-g.ts";
import type { VInputs } from "./factor-v.ts";
import type { MInputs } from "./factor-m.ts";
import type { SInputs } from "./factor-s.ts";
import type { InsiderFiling } from "./factor-insider.ts";
import { detectClusterOverride } from "./factor-insider.ts";
import type { FactorScores, MacroGauges } from "./composite.ts";
import type {
  AiqRubricSnap,
  CapexSnap,
  DepFlagRow,
  QuarterlyInputs,
} from "./quarterly-checklist.ts";

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

// ---------------------------------------------------------------------------
// M-score cohort loading (THS-58). Pulls prices ±13mo and ±1mo per ticker
// for the 12-1 momentum return, the latest reported quarterly EPS
// (net_income / shares_diluted), the consensus fy1_eps from the snapshot
// nearest before that report (proxy for "expected EPS at report"), and
// the latest revisions row's upward_breadth_pct.
//
// Layer-agnostic by design — momentum z-scores across the full
// investable cohort, not within layer. Returns a flat array.
// ---------------------------------------------------------------------------

interface MPriceRow {
  ticker: string;
  date: string;
  close: number | null;
}

interface MFundsRow {
  ticker: string;
  period_end: string;
  net_income: number | null;
  shares_diluted: number | null;
}

interface MConsensusRow {
  ticker: string;
  as_of: string;
  fy1_eps: number | null;
}

interface MRevisionsRow {
  ticker: string;
  as_of: string;
  upward_breadth_pct: number | null;
}

export async function loadMInputs(client: SupabaseClient, asOf: string): Promise<MInputs[]> {
  // Investable universe — momentum is computed across L1..L5 together.
  const univ = await client
    .from("universe")
    .select("ticker, layer")
    .eq("is_active", true)
    .eq("kind", "investable")
    .order("ticker");
  if (univ.error) throw univ.error;
  const universe = (univ.data ?? []) as UniverseRow[];
  if (universe.length === 0) return [];
  const tickers = universe.map((u) => u.ticker);

  // ─── Price snapshots ─────────────────────────────────────────────────
  // 12-1 window: close at ~-13mo (start) and ~-1mo (end). We pull a band
  // of dates and pick the closest available trading day inside the band
  // so weekend/holiday targets don't kill the signal.
  const target13mo = isoDateMinusDays(asOf, 395); // ~13mo ago
  const band13mo = isoDateMinusDays(target13mo, -10); // +10d band
  const target1mo = isoDateMinusDays(asOf, 30);
  const band1mo = isoDateMinusDays(target1mo, -7);

  const pricesRes = await client
    .from("prices_raw")
    .select("ticker, date, close")
    .in("ticker", tickers)
    .or(`and(date.gte.${target13mo},date.lte.${band13mo}),and(date.gte.${target1mo},date.lte.${band1mo})`)
    .order("ticker")
    .order("date", { ascending: true });
  if (pricesRes.error) throw pricesRes.error;

  const close13mo = new Map<string, number>();
  const close1mo = new Map<string, number>();
  for (const r of (pricesRes.data ?? []) as MPriceRow[]) {
    if (r.close == null) continue;
    if (r.date >= target13mo && r.date <= band13mo && !close13mo.has(r.ticker)) {
      close13mo.set(r.ticker, Number(r.close));
    }
    if (r.date >= target1mo && r.date <= band1mo && !close1mo.has(r.ticker)) {
      close1mo.set(r.ticker, Number(r.close));
    }
  }

  // ─── Latest quarterly fundamentals → actual EPS ──────────────────────
  const fundsRes = await client
    .from("fundamentals_raw")
    .select("ticker, period_end, net_income, shares_diluted")
    .eq("period_type", "Q")
    .lte("period_end", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("period_end", { ascending: false });
  if (fundsRes.error) throw fundsRes.error;
  const latestFunds = new Map<string, MFundsRow>();
  for (const r of (fundsRes.data ?? []) as MFundsRow[]) {
    if (!latestFunds.has(r.ticker)) latestFunds.set(r.ticker, r);
  }

  // ─── Consensus fy1_eps just before each ticker's report ──────────────
  // Strategy: for each ticker with a known latest period_end, query the
  // consensus row with as_of < period_end, take the most recent. Batched
  // by a single OR query — fine for 50-name v1.
  const expectedEpsByTicker = new Map<string, number>();
  const periodEnds = Array.from(latestFunds.values()).map((f) => ({ ticker: f.ticker, period_end: f.period_end }));
  if (periodEnds.length > 0) {
    // Pull a 45-day pre-report window for every ticker, then resolve
    // closest-before-report in code.
    const oldestPe = periodEnds.reduce((m, x) => (x.period_end < m ? x.period_end : m), periodEnds[0].period_end);
    const consensusFrom = isoDateMinusDays(oldestPe, 60);
    const consensusRes = await client
      .from("consensus")
      .select("ticker, as_of, fy1_eps")
      .gte("as_of", consensusFrom)
      .lte("as_of", asOf)
      .in("ticker", tickers)
      .order("ticker")
      .order("as_of", { ascending: false });
    if (consensusRes.error) throw consensusRes.error;
    const byTicker = new Map<string, MConsensusRow[]>();
    for (const r of (consensusRes.data ?? []) as MConsensusRow[]) {
      const arr = byTicker.get(r.ticker);
      if (arr) arr.push(r);
      else byTicker.set(r.ticker, [r]);
    }
    for (const { ticker, period_end } of periodEnds) {
      const rows = byTicker.get(ticker) ?? [];
      const pre = rows.find((r) => r.as_of < period_end && r.fy1_eps != null);
      if (pre?.fy1_eps != null) expectedEpsByTicker.set(ticker, Number(pre.fy1_eps));
    }
  }

  // ─── Latest revisions row per ticker ─────────────────────────────────
  const revsRes = await client
    .from("revisions")
    .select("ticker, as_of, upward_breadth_pct")
    .lte("as_of", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("as_of", { ascending: false });
  if (revsRes.error) throw revsRes.error;
  const latestRev = new Map<string, MRevisionsRow>();
  for (const r of (revsRes.data ?? []) as MRevisionsRow[]) {
    if (!latestRev.has(r.ticker)) latestRev.set(r.ticker, r);
  }

  // ─── Stitch ──────────────────────────────────────────────────────────
  const out: MInputs[] = [];
  for (const u of universe) {
    const layer = u.layer as Layer;
    if (layer < 1 || layer > 5) continue;
    const f = latestFunds.get(u.ticker);
    const actualEps =
      f && f.net_income != null && f.shares_diluted != null && f.shares_diluted !== 0
        ? Number(f.net_income) / Number(f.shares_diluted)
        : null;
    out.push({
      ticker: u.ticker,
      layer,
      close_13mo: close13mo.get(u.ticker) ?? null,
      close_1mo: close1mo.get(u.ticker) ?? null,
      actual_eps_latest: actualEps,
      expected_eps_at_report: expectedEpsByTicker.get(u.ticker) ?? null,
      upward_breadth_pct: latestRev.get(u.ticker)?.upward_breadth_pct ?? null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// S-score cohort loading (THS-62). Pulls FY1 EPS 30d revisions delta,
// latest SUSI z, and computes the insider asymmetric override from the
// last 90 days of Form-4 transactions per ticker. Options skew is null
// until THS-59 options ingestion ships — the S-composite handles this
// via partial-coverage rescaling.
// ---------------------------------------------------------------------------

interface SRevisionsRow {
  ticker: string;
  as_of: string;
  fy1_eps_30d_pct_change: number | null;
}

interface SSusiRow {
  ticker: string;
  settlement_date: string;
  susi_z: number | null;
}

interface SInsiderRow {
  ticker: string;
  transaction_date: string;
  insider_name: string;
  insider_title: string | null;
  transaction_code: string;
  acquired_disposed: "A" | "D" | null;
  shares: number | null;
  price_per_share: number | null;
  transaction_value: number | null;
  is_10b5_1: boolean | null;
}

export async function loadSInputs(client: SupabaseClient, asOf: string): Promise<SInputs[]> {
  const univ = await client
    .from("universe")
    .select("ticker, layer")
    .eq("is_active", true)
    .eq("kind", "investable")
    .order("ticker");
  if (univ.error) throw univ.error;
  const universe = (univ.data ?? []) as UniverseRow[];
  if (universe.length === 0) return [];
  const tickers = universe.map((u) => u.ticker);

  // Revisions delta (latest as_of ≤ run as_of per ticker).
  const revFrom = isoDateMinusDays(asOf, 60);
  const revRes = await client
    .from("revisions")
    .select("ticker, as_of, fy1_eps_30d_pct_change")
    .gte("as_of", revFrom)
    .lte("as_of", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("as_of", { ascending: false });
  if (revRes.error) throw revRes.error;
  const latestRev = new Map<string, SRevisionsRow>();
  for (const r of (revRes.data ?? []) as SRevisionsRow[]) {
    if (!latestRev.has(r.ticker)) latestRev.set(r.ticker, r);
  }

  // SUSI z (latest per ticker).
  const susiRes = await client
    .from("short_interest_raw")
    .select("ticker, settlement_date, susi_z")
    .lte("settlement_date", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("settlement_date", { ascending: false });
  if (susiRes.error) throw susiRes.error;
  const latestSusi = new Map<string, SSusiRow>();
  for (const r of (susiRes.data ?? []) as SSusiRow[]) {
    if (!latestSusi.has(r.ticker)) latestSusi.set(r.ticker, r);
  }

  // Insider transactions in the last 90 days (BUY cluster window).
  const insiderFrom = isoDateMinusDays(asOf, 90);
  const insiderRes = await client
    .from("insider_form4_raw")
    .select(
      "ticker, transaction_date, insider_name, insider_title, transaction_code, acquired_disposed, shares, price_per_share, transaction_value, is_10b5_1",
    )
    .gte("transaction_date", insiderFrom)
    .lte("transaction_date", asOf)
    .in("ticker", tickers);
  if (insiderRes.error) throw insiderRes.error;
  const insidersByTicker = new Map<string, SInsiderRow[]>();
  for (const r of (insiderRes.data ?? []) as SInsiderRow[]) {
    const arr = insidersByTicker.get(r.ticker);
    if (arr) arr.push(r);
    else insidersByTicker.set(r.ticker, [r]);
  }

  const out: SInputs[] = [];
  for (const u of universe) {
    const layer = u.layer as Layer;
    if (layer < 1 || layer > 5) continue;
    const insiders: InsiderFiling[] = (insidersByTicker.get(u.ticker) ?? []).map((r) => ({
      ticker: r.ticker,
      transaction_date: r.transaction_date,
      insider_name: r.insider_name,
      insider_title: r.insider_title,
      transaction_code: r.transaction_code,
      acquired_disposed: r.acquired_disposed,
      shares: r.shares,
      price_per_share: r.price_per_share,
      transaction_value: r.transaction_value,
      is_10b5_1: r.is_10b5_1,
    }));
    const cluster = detectClusterOverride(insiders, asOf);
    out.push({
      ticker: u.ticker,
      layer,
      revisions_delta: latestRev.get(u.ticker)?.fy1_eps_30d_pct_change ?? null,
      options_skew: null, // THS-59 pending
      susi_z: latestSusi.get(u.ticker)?.susi_z ?? null,
      insider_override: cluster.kind == null ? 0 : cluster.override,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Concentration-tax cohort loading (THS-63). Pulls 120 trading days of
// prices_raw per investable ticker, derives daily simple returns, and
// joins supply_chain_deps to count per-ticker degrees. Output drives
// `computeConcentrationTax` in concentration.ts.
// ---------------------------------------------------------------------------

interface ConcentrationPriceRow {
  ticker: string;
  date: string;
  close: number | null;
}

interface SupplyChainEdge {
  dependent_ticker: string;
  vendor_ticker: string;
}

export interface ConcentrationLoaded {
  returns: Map<string, number[]>;
  supplyChainDegree: Map<string, number>;
}

export async function loadConcentrationInputs(
  client: SupabaseClient,
  asOf: string,
): Promise<ConcentrationLoaded> {
  const univ = await client
    .from("universe")
    .select("ticker")
    .eq("is_active", true)
    .eq("kind", "investable")
    .order("ticker");
  if (univ.error) throw univ.error;
  const universe = (univ.data ?? []) as Array<{ ticker: string }>;
  const tickers = universe.map((u) => u.ticker);
  if (tickers.length === 0) {
    return { returns: new Map(), supplyChainDegree: new Map() };
  }

  // 120 trading days ≈ 175 calendar days back to be safe.
  const from = isoDateMinusDays(asOf, 175);
  const pricesRes = await client
    .from("prices_raw")
    .select("ticker,date,close")
    .gte("date", from)
    .lte("date", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("date", { ascending: true });
  if (pricesRes.error) throw pricesRes.error;

  const closeByTicker = new Map<string, Array<{ date: string; close: number }>>();
  for (const r of (pricesRes.data ?? []) as ConcentrationPriceRow[]) {
    if (r.close == null) continue;
    const arr = closeByTicker.get(r.ticker) ?? [];
    arr.push({ date: r.date, close: Number(r.close) });
    closeByTicker.set(r.ticker, arr);
  }

  const returns = new Map<string, number[]>();
  for (const t of tickers) {
    const series = closeByTicker.get(t) ?? [];
    if (series.length < 30) continue;
    const r: number[] = [];
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1].close;
      const b = series[i].close;
      if (a > 0 && b > 0) r.push((b - a) / a);
    }
    if (r.length >= 30) returns.set(t, r.slice(-120));
  }

  // Supply-chain degrees (in + out).
  const edgesRes = await client
    .from("supply_chain_deps")
    .select("dependent_ticker,vendor_ticker")
    .in("dependent_ticker", tickers)
    .in("vendor_ticker", tickers);
  if (edgesRes.error) throw edgesRes.error;
  const supplyChainDegree = new Map<string, number>();
  for (const t of tickers) supplyChainDegree.set(t, 0);
  for (const e of (edgesRes.data ?? []) as SupplyChainEdge[]) {
    supplyChainDegree.set(e.dependent_ticker, (supplyChainDegree.get(e.dependent_ticker) ?? 0) + 1);
    supplyChainDegree.set(e.vendor_ticker, (supplyChainDegree.get(e.vendor_ticker) ?? 0) + 1);
  }

  return { returns, supplyChainDegree };
}

// ---------------------------------------------------------------------------
// Quarterly-review loading (THS-67). Pulls everything the checklist needs:
//   - depreciation_flags rows added in the review window
//   - latest two aiq_rubric snapshots per ticker
//   - hyperscaler 90-day returns for current + prior windows
//   - hyperscaler trailing-12mo capex for current + prior year
// Output drives `buildQuarterlyChecklist` in quarterly-checklist.ts.
// ---------------------------------------------------------------------------

const HYPERSCALER_TICKERS = ["MSFT", "GOOGL", "AMZN", "META", "ORCL"] as const;
const QUARTER_LOOKBACK_DAYS = 90;
const RETURNS_WINDOW_DAYS = 90;
const RETURNS_CALENDAR_BUFFER_DAYS = 135; // ~90 trading days + buffer

interface CapexRow {
  ticker: string;
  period_end: string;
  period_type: "Q" | "A";
  capex: number | null;
}

export async function loadQuarterlyInputs(
  client: SupabaseClient,
  asOf: string,
): Promise<QuarterlyInputs> {
  const windowStart = isoDateMinusDays(asOf, QUARTER_LOOKBACK_DAYS);

  // 1. Dep-flag rows in window.
  const depRes = await client
    .from("depreciation_flags")
    .select("ticker, flagged_at, extension_years, penalty_v")
    .gte("flagged_at", windowStart)
    .lte("flagged_at", asOf)
    .order("flagged_at", { ascending: false });
  if (depRes.error) throw depRes.error;
  const newDepFlags = (depRes.data ?? []) as DepFlagRow[];

  // 2. AIQ rubric latest two per ticker.
  const aiqRes = await client
    .from("aiq_rubric")
    .select("ticker, scored_at, total")
    .lte("scored_at", asOf)
    .order("ticker", { ascending: true })
    .order("scored_at", { ascending: false });
  if (aiqRes.error) throw aiqRes.error;
  const aiqByTicker = new Map<string, AiqRubricSnap[]>();
  for (const row of (aiqRes.data ?? []) as AiqRubricSnap[]) {
    const arr = aiqByTicker.get(row.ticker) ?? [];
    if (arr.length < 2) arr.push(row);
    aiqByTicker.set(row.ticker, arr);
  }

  // 3. Hyperscaler returns — two non-overlapping 90-day windows.
  const priorWindowEnd = isoDateMinusDays(asOf, RETURNS_WINDOW_DAYS);
  const currentFrom = isoDateMinusDays(asOf, RETURNS_CALENDAR_BUFFER_DAYS);
  const priorFrom = isoDateMinusDays(priorWindowEnd, RETURNS_CALENDAR_BUFFER_DAYS);

  const [currentPxRes, priorPxRes] = await Promise.all([
    client
      .from("prices_raw")
      .select("ticker,date,close")
      .gte("date", currentFrom)
      .lte("date", asOf)
      .in("ticker", HYPERSCALER_TICKERS as readonly string[])
      .order("ticker")
      .order("date", { ascending: true }),
    client
      .from("prices_raw")
      .select("ticker,date,close")
      .gte("date", priorFrom)
      .lte("date", priorWindowEnd)
      .in("ticker", HYPERSCALER_TICKERS as readonly string[])
      .order("ticker")
      .order("date", { ascending: true }),
  ]);
  if (currentPxRes.error) throw currentPxRes.error;
  if (priorPxRes.error) throw priorPxRes.error;

  const currentReturns = buildHyperscalerReturns(
    (currentPxRes.data ?? []) as ConcentrationPriceRow[],
  );
  const priorReturns = buildHyperscalerReturns(
    (priorPxRes.data ?? []) as ConcentrationPriceRow[],
  );

  // 4. Hyperscaler trailing-12mo capex (current + prior year).
  // Pull the last ~8 quarters of capex; build TTM for asOf and TTM for asOf-1y.
  const oneYearAgo = isoDateMinusDays(asOf, 365);
  const capexFrom = isoDateMinusDays(asOf, 365 + 400); // ~2y back to be safe
  const capexRes = await client
    .from("fundamentals_raw")
    .select("ticker, period_end, period_type, capex")
    .gte("period_end", capexFrom)
    .lte("period_end", asOf)
    .eq("period_type", "Q")
    .in("ticker", HYPERSCALER_TICKERS as readonly string[])
    .order("ticker")
    .order("period_end", { ascending: false });
  if (capexRes.error) throw capexRes.error;
  const hyperscalerCapex = buildHyperscalerCapex(
    (capexRes.data ?? []) as CapexRow[],
    asOf,
    oneYearAgo,
  );

  return {
    as_of: asOf,
    window_start: windowStart,
    newDepFlags,
    aiqByTicker,
    hyperscalerReturns: { current: currentReturns, prior: priorReturns },
    hyperscalerCapex,
    is_annual_trigger: isAnnualTrigger(asOf),
  };
}

function buildHyperscalerReturns(rows: ConcentrationPriceRow[]): Map<string, number[]> {
  const closes = new Map<string, Array<{ date: string; close: number }>>();
  for (const r of rows) {
    if (r.close == null) continue;
    const arr = closes.get(r.ticker) ?? [];
    arr.push({ date: r.date, close: Number(r.close) });
    closes.set(r.ticker, arr);
  }
  const out = new Map<string, number[]>();
  for (const [t, series] of closes) {
    if (series.length < 10) continue;
    const r: number[] = [];
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1].close;
      const b = series[i].close;
      if (a > 0 && b > 0) r.push((b - a) / a);
    }
    if (r.length >= 10) out.set(t, r.slice(-RETURNS_WINDOW_DAYS));
  }
  return out;
}

function buildHyperscalerCapex(
  rows: CapexRow[],
  asOf: string,
  oneYearAgo: string,
): CapexSnap[] {
  const byTicker = new Map<string, CapexRow[]>();
  for (const r of rows) {
    const arr = byTicker.get(r.ticker) ?? [];
    arr.push(r);
    byTicker.set(r.ticker, arr);
  }
  const out: CapexSnap[] = [];
  for (const ticker of HYPERSCALER_TICKERS) {
    const all = byTicker.get(ticker) ?? []; // already sorted period_end desc
    const currentSlice = all.filter((r) => r.period_end <= asOf).slice(0, 4);
    const priorSlice = all
      .filter((r) => r.period_end <= oneYearAgo)
      .slice(0, 4);
    out.push({
      ticker,
      current_ttm_capex: sumCapex(currentSlice),
      prior_ttm_capex: sumCapex(priorSlice),
    });
  }
  return out;
}

function sumCapex(rows: CapexRow[]): number | null {
  if (rows.length < 4) return null;
  let s = 0;
  let n = 0;
  for (const r of rows) {
    if (r.capex == null) continue;
    s += Number(r.capex);
    n++;
  }
  return n >= 4 ? s : null;
}

/** True iff `asOf` falls in February (Q1 review fires the annual trigger). */
function isAnnualTrigger(asOf: string): boolean {
  return /-02-/.test(asOf);
}

// ---------------------------------------------------------------------------
// Composite-score loading (THS-45). Reads scores_history (q/g/v from the
// per-factor jobs that ran earlier on the same as_of), aiq_rubric (latest
// row per ticker, manually scored), macro_gauges (latest snapshot), and
// the universe → layer mapping.
// ---------------------------------------------------------------------------

export interface CompositeInputs {
  ticker: string;
  layer: Layer;
  scores: FactorScores;
}

export interface CompositeLoadResult {
  inputs: CompositeInputs[];
  gauges: MacroGauges;
  gaugesAsOf: string | null;
}

interface ScoresHistoryRow {
  ticker: string;
  q_score: number | null;
  g_score: number | null;
  v_score: number | null;
  m_score: number | null;
  s_score: number | null;
}

interface AiqRubricRow {
  ticker: string;
  scored_at: string;
  total: number | null;
}

interface MacroGaugesRow {
  as_of: string;
  naaim: number | null;
  aaii_3wk_spread: number | null;
  fear_greed: number | null;
}

export async function loadCompositeInputs(
  client: SupabaseClient,
  asOf: string,
): Promise<CompositeLoadResult> {
  // Universe.
  const univ = await client
    .from("universe")
    .select("ticker, layer")
    .eq("is_active", true)
    .eq("kind", "investable")
    .order("ticker");
  if (univ.error) throw univ.error;
  const universe = (univ.data ?? []) as UniverseRow[];
  if (universe.length === 0) {
    return { inputs: [], gauges: { naaim: null, aaii_3wk_spread: null, fear_greed: null }, gaugesAsOf: null };
  }
  const tickers = universe.map((u) => u.ticker);

  // q/g/v/m/s scores for the run's as_of row, written by the per-factor
  // jobs. m and s are null until their compute jobs (THS-58/THS-62) have
  // run for this as_of; composite.ts handles partial coverage by rescaling
  // tier-A weights when M and/or S are missing.
  const shRes = await client
    .from("scores_history")
    .select("ticker, q_score, g_score, v_score, m_score, s_score")
    .eq("as_of", asOf)
    .in("ticker", tickers);
  if (shRes.error) throw shRes.error;
  const scoresByTicker = new Map<string, ScoresHistoryRow>();
  for (const row of (shRes.data ?? []) as ScoresHistoryRow[]) {
    scoresByTicker.set(row.ticker, row);
  }

  // AIQ — manually scored quarterly. Take the latest scored_at ≤ as_of per
  // ticker. `total` is GENERATED ALWAYS in the schema, sum of six dims.
  const aiqRes = await client
    .from("aiq_rubric")
    .select("ticker, scored_at, total")
    .lte("scored_at", asOf)
    .in("ticker", tickers)
    .order("ticker")
    .order("scored_at", { ascending: false });
  if (aiqRes.error) throw aiqRes.error;
  const aiqLatest = new Map<string, AiqRubricRow>();
  for (const row of (aiqRes.data ?? []) as AiqRubricRow[]) {
    if (!aiqLatest.has(row.ticker)) aiqLatest.set(row.ticker, row);
  }

  // Macro gauges — latest as_of ≤ run as_of. Composite uses one global
  // snapshot per run.
  const mgRes = await client
    .from("macro_gauges")
    .select("as_of, naaim, aaii_3wk_spread, fear_greed")
    .lte("as_of", asOf)
    .order("as_of", { ascending: false })
    .limit(1);
  if (mgRes.error) throw mgRes.error;
  const mg = ((mgRes.data ?? []) as MacroGaugesRow[])[0] ?? null;
  const gauges: MacroGauges = {
    naaim: mg?.naaim ?? null,
    aaii_3wk_spread: mg?.aaii_3wk_spread ?? null,
    fear_greed: mg?.fear_greed ?? null,
  };

  const inputs: CompositeInputs[] = [];
  for (const u of universe) {
    const layer = u.layer as Layer;
    if (layer < 1 || layer > 5) continue;
    const sh = scoresByTicker.get(u.ticker);
    const aiq = aiqLatest.get(u.ticker);
    inputs.push({
      ticker: u.ticker,
      layer,
      scores: {
        q: sh?.q_score ?? null,
        g: sh?.g_score ?? null,
        v: sh?.v_score ?? null,
        aiq: aiq?.total ?? null,
        m: sh?.m_score ?? null,
        s: sh?.s_score ?? null,
      },
    });
  }

  return { inputs, gauges, gaugesAsOf: mg?.as_of ?? null };
}

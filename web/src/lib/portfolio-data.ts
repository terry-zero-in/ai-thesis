/**
 * Server-only fetcher for the /portfolio dashboard (THS-55).
 *
 * Pulls in one round-trip:
 *   - portfolio_settings (singleton with total_capital, target_reserve)
 *   - portfolio_positions (open positions only — closed_at IS NULL)
 *   - latest prices_raw.close for each held ticker (joined client-side)
 *   - last 2 SPY closes (for the SPY -5% single-day trigger)
 *
 * Computes derived aggregates (deployed, market value, P&L) and trigger
 * states in pure JS so the page can server-render without any client math.
 *
 * Fixture mode: when env is unset, returns an empty portfolio with the
 * default settings (100K capital / 20K reserve) so the page renders the
 * empty state cleanly. Current prices for any seeded positions get
 * fixture closes via a deterministic per-ticker hash.
 *
 * VIX trigger (trigger 2b) is flagged as "data pending" — VIX ingestion
 * isn't shipped yet (open follow-on, THS-61 candidate). The market_triggers
 * array still includes a stub MarketTrigger record so the UI can render
 * the pending state next to the SPY trigger.
 */
import { getSupabaseServer } from "./supabase/server";
import { FIXTURE_INDEX, FIXTURE_UNIVERSE } from "./universe-fixture";
import {
  POSITION_DRAWDOWN_TRIGGER,
  SPY_DAILY_DROP_TRIGGER,
  type MarketTrigger,
  type PortfolioSnapshot,
  type PositionRow,
  type PositionTrigger,
  type UniverseChoice,
} from "./portfolio-types";

const DEFAULT_SETTINGS = { total_capital: 100000, target_reserve: 20000 };

interface PositionDbRow {
  ticker: string;
  shares: number;
  cost_basis: number;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

interface PriceRow {
  ticker: string;
  date: string;
  close: number | null;
}

export async function getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) {
    return emptySnapshot(false, false);
  }

  const [settingsRes, positionsRes] = await Promise.all([
    sb.from("portfolio_settings").select("total_capital,target_reserve").eq("id", 1).maybeSingle(),
    sb
      .from("portfolio_positions")
      .select("ticker,shares,cost_basis,opened_at,closed_at,notes")
      .is("closed_at", null)
      .order("opened_at", { ascending: true }),
  ]);

  const settings = settingsRes.data
    ? { total_capital: Number(settingsRes.data.total_capital), target_reserve: Number(settingsRes.data.target_reserve) }
    : DEFAULT_SETTINGS;
  const positionDbRows = (positionsRes.data ?? []) as PositionDbRow[];

  if (positionDbRows.length === 0) {
    // Settings exist but no positions yet — render empty state with real settings.
    const spySnap = await fetchSpySnapshot(sb);
    return finalizeSnapshot([], settings, spySnap, true, false);
  }

  const tickers = positionDbRows.map((p) => p.ticker);

  // Latest close per ticker — uses the (ticker, date DESC) index from THS-35.
  // One round trip pulling 5 rows per ticker is fine for v1 (<=50 names).
  const { data: priceData } = await sb
    .from("prices_raw")
    .select("ticker,date,close")
    .in("ticker", tickers)
    .order("date", { ascending: false })
    .limit(tickers.length * 3);
  const priceMap = latestPriceMap((priceData ?? []) as PriceRow[]);

  // Universe rows for layer/name labels.
  const { data: univData } = await sb
    .from("universe")
    .select("ticker,name,layer,layer_label")
    .in("ticker", tickers);
  const univMap = new Map(((univData ?? []) as UniverseChoice[]).map((u) => [u.ticker, u]));

  const positions: PositionRow[] = positionDbRows.map((p) => {
    const price = priceMap.get(p.ticker) ?? null;
    const u = univMap.get(p.ticker) ?? FIXTURE_INDEX[p.ticker] ?? fallbackUniverseRow(p.ticker);
    return {
      ticker: p.ticker,
      shares: Number(p.shares),
      cost_basis: Number(p.cost_basis),
      opened_at: p.opened_at,
      closed_at: p.closed_at,
      notes: p.notes,
      current_price: price ? Number(price.close) : null,
      current_price_as_of: price?.date ?? null,
      name: u.name,
      layer: u.layer,
      layer_label: u.layer_label,
    };
  });

  const spySnap = await fetchSpySnapshot(sb);

  return finalizeSnapshot(positions, settings, spySnap, true, false);
}

/** Fixture-mode universe options for the position-add select. */
export function getUniverseChoices(): UniverseChoice[] {
  return FIXTURE_UNIVERSE.filter((u) => u.layer >= 1).map((u) => ({
    ticker: u.ticker,
    name: u.name,
    layer: u.layer,
    layer_label: u.layer_label,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function latestPriceMap(rows: PriceRow[]): Map<string, PriceRow> {
  const out = new Map<string, PriceRow>();
  for (const r of rows) {
    const existing = out.get(r.ticker);
    if (!existing || r.date > existing.date) out.set(r.ticker, r);
  }
  return out;
}

interface SpySnap {
  spy_close: number | null;
  spy_close_prior: number | null;
  spy_as_of: string | null;
}

async function fetchSpySnapshot(sb: NonNullable<Awaited<ReturnType<typeof getSupabaseServer>>>): Promise<SpySnap> {
  const { data } = await sb
    .from("prices_raw")
    .select("date,close")
    .eq("ticker", "SPY")
    .order("date", { ascending: false })
    .limit(2);
  const rows = (data ?? []) as { date: string; close: number | null }[];
  if (rows.length === 0) return { spy_close: null, spy_close_prior: null, spy_as_of: null };
  return {
    spy_close: rows[0].close != null ? Number(rows[0].close) : null,
    spy_close_prior: rows[1]?.close != null ? Number(rows[1].close) : null,
    spy_as_of: rows[0].date,
  };
}

function finalizeSnapshot(
  positions: PositionRow[],
  settings: { total_capital: number; target_reserve: number },
  spy: SpySnap,
  envConfigured: boolean,
  synthetic_prices: boolean,
): PortfolioSnapshot {
  let total_deployed = 0;
  let total_market_value = 0;
  const position_triggers: PositionTrigger[] = [];

  for (const p of positions) {
    const cost = p.cost_basis * p.shares;
    total_deployed += cost;
    if (p.current_price != null) {
      const mv = p.current_price * p.shares;
      total_market_value += mv;
      const pct = (p.current_price - p.cost_basis) / p.cost_basis;
      if (pct <= POSITION_DRAWDOWN_TRIGGER) {
        position_triggers.push({
          ticker: p.ticker,
          pct_drawdown: pct,
          market_value: mv,
          cost_total: cost,
        });
      }
    } else {
      // Missing current price: treat market value = cost basis so the
      // aggregate doesn't go negative on uningested tickers.
      total_market_value += cost;
    }
  }

  const total_pl = total_market_value - total_deployed;
  const total_pl_pct = total_deployed > 0 ? total_pl / total_deployed : 0;
  const reserve_actual = settings.total_capital - total_deployed;
  const market_triggers = computeMarketTriggers(spy);

  return {
    positions,
    settings,
    total_deployed,
    total_market_value,
    total_pl,
    total_pl_pct,
    reserve_actual,
    position_triggers,
    market_triggers,
    spy_close: spy.spy_close,
    spy_close_prior: spy.spy_close_prior,
    spy_as_of: spy.spy_as_of,
    empty: positions.length === 0,
    envConfigured,
    synthetic_prices,
  };
}

function computeMarketTriggers(spy: SpySnap): MarketTrigger[] {
  const triggers: MarketTrigger[] = [];

  // Trigger 2a — SPY single-day drop ≥ 5%.
  if (spy.spy_close != null && spy.spy_close_prior != null && spy.spy_close_prior > 0) {
    const pct = (spy.spy_close - spy.spy_close_prior) / spy.spy_close_prior;
    const fired = pct <= SPY_DAILY_DROP_TRIGGER;
    triggers.push({
      kind: "spy_daily_drop",
      fired,
      detail: fired
        ? `SPY ${formatPct(pct)} vs prior close (${spy.spy_close.toFixed(2)} from ${spy.spy_close_prior.toFixed(2)} on ${spy.spy_as_of}).`
        : `SPY ${formatPct(pct)} vs prior close (no trigger).`,
    });
  } else {
    triggers.push({
      kind: "spy_daily_drop",
      fired: false,
      detail: "Awaiting SPY price ingestion (need ≥2 days of prices_raw rows).",
    });
  }

  // Trigger 2b — VIX > 25 for 3+ days. Not yet ingested; flagged pending.
  triggers.push({
    kind: "vix_sustained",
    fired: false,
    detail: "VIX ingestion pending (open follow-on — no prices_raw row for VIX yet).",
  });

  return triggers;
}

function emptySnapshot(envConfigured: boolean, synthetic_prices: boolean): PortfolioSnapshot {
  return {
    ...emptyAggregate(DEFAULT_SETTINGS),
    spy_close: null,
    spy_close_prior: null,
    spy_as_of: null,
    market_triggers: [
      {
        kind: "spy_daily_drop",
        fired: false,
        detail: "Awaiting SPY price ingestion (need ≥2 days of prices_raw rows).",
      },
      {
        kind: "vix_sustained",
        fired: false,
        detail: "VIX ingestion pending (open follow-on — no prices_raw row for VIX yet).",
      },
    ],
    empty: true,
    envConfigured,
    synthetic_prices,
    settings: DEFAULT_SETTINGS,
  };
}

function emptyAggregate(settings: { total_capital: number; target_reserve: number }) {
  return {
    positions: [] as PositionRow[],
    total_deployed: 0,
    total_market_value: 0,
    total_pl: 0,
    total_pl_pct: 0,
    reserve_actual: settings.total_capital,
    position_triggers: [] as PositionTrigger[],
  };
}

function fallbackUniverseRow(ticker: string): UniverseChoice {
  return { ticker, name: ticker, layer: 0, layer_label: "Unknown" };
}

function formatPct(p: number): string {
  return `${(p * 100).toFixed(2)}%`;
}

/**
 * Server-only fetcher for the /portfolio dashboard (THS-55).
 *
 * Pulls in one round-trip:
 *   - portfolio_settings (singleton with total_capital, target_reserve)
 *   - portfolio_positions (open positions only — closed_at IS NULL)
 *   - portfolio_positions (closed — closed_at IS NOT NULL) for the
 *     Realized P&L history section (THS-103)
 *   - latest prices_raw.close for each held ticker (joined client-side)
 *   - last 2 SPY closes (for the SPY -5% single-day trigger)
 *
 * Computes derived aggregates (deployed, market value, P&L, realized P&L,
 * reserve) and trigger states in pure JS so the page can server-render
 * without any client math.
 *
 * Reserve formula (THS-103):
 *   reserve_actual = total_capital + total_realized_pl − Σ(cost_basis × open_shares)
 * The realized_pl term reconciles: proceeds from past sales return to the
 * pool; profit accumulates, loss subtracts.
 *
 * VIX trigger (trigger 2b) is flagged as "data pending" — VIX ingestion
 * isn't shipped yet (open follow-on, THS-61 candidate). The market_triggers
 * array still includes a stub MarketTrigger record so the UI can render
 * the pending state next to the SPY trigger.
 */
import { getSupabaseServer } from "./supabase/server";
import {
  POSITION_DRAWDOWN_TRIGGER,
  SPY_DAILY_DROP_TRIGGER,
  VIX_LEVEL_TRIGGER,
  type ClosedPositionRow,
  type MarketTrigger,
  type PortfolioSnapshot,
  type PositionRow,
  type PositionTrigger,
  type UniverseChoice,
} from "./portfolio-types";
import type { Tier } from "./universe-data";

const DEFAULT_SETTINGS = { total_capital: 100000, target_reserve: 20000 };

interface PositionDbRow {
  ticker: string;
  shares: number;
  cost_basis: number;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  exit_price: number | null;
  realized_pl: number | null;
  realized_proceeds: number | null;
  original_shares: number | null;
}

interface PriceRow {
  ticker: string;
  date: string;
  close: number | null;
}

interface ScoreRow {
  ticker: string;
  as_of: string;
  composite: number | null;
  tier: Tier | null;
}

interface TaxRow {
  ticker: string;
  as_of: string;
  tax: number | null;
}

export async function getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) {
    return emptySnapshot(false);
  }

  const [settingsRes, openRes, closedRes] = await Promise.all([
    sb.from("portfolio_settings").select("total_capital,target_reserve").eq("id", 1).maybeSingle(),
    sb
      .from("portfolio_positions")
      .select(
        "ticker,shares,cost_basis,opened_at,closed_at,notes,exit_price,realized_pl,realized_proceeds,original_shares",
      )
      .is("closed_at", null)
      .order("opened_at", { ascending: true }),
    sb
      .from("portfolio_positions")
      .select(
        "ticker,shares,cost_basis,opened_at,closed_at,notes,exit_price,realized_pl,realized_proceeds,original_shares",
      )
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false }),
  ]);

  const settings = settingsRes.data
    ? { total_capital: Number(settingsRes.data.total_capital), target_reserve: Number(settingsRes.data.target_reserve) }
    : DEFAULT_SETTINGS;
  const openDbRows = (openRes.data ?? []) as PositionDbRow[];
  const closedDbRows = (closedRes.data ?? []) as PositionDbRow[];

  // Tickers we need joined universe / price / score / tax data for. Open
  // positions need the full join chain (current price, score, concentration
  // tax). Closed positions only need universe (name + layer).
  const openTickers = openDbRows.map((p) => p.ticker);
  const closedTickers = closedDbRows.map((p) => p.ticker);
  const allTickers = Array.from(new Set([...openTickers, ...closedTickers]));

  if (allTickers.length === 0) {
    const [spySnap, vixSnap] = await Promise.all([fetchSpySnapshot(sb), fetchVixSnapshot(sb)]);
    return finalizeSnapshot([], [], settings, spySnap, vixSnap, true);
  }

  const [priceRes, univRes, scoreRes, taxRes] = await Promise.all([
    openTickers.length > 0
      ? sb
          .from("prices_raw")
          .select("ticker,date,close")
          .in("ticker", openTickers)
          .order("date", { ascending: false })
          .limit(Math.max(openTickers.length, 1) * 3)
      : Promise.resolve({ data: [] as PriceRow[] }),
    sb.from("universe").select("ticker,name,layer,layer_label").in("ticker", allTickers),
    openTickers.length > 0
      ? sb
          .from("scores_history")
          .select("ticker,as_of,composite,tier")
          .in("ticker", openTickers)
          .order("as_of", { ascending: false })
          .limit(Math.max(openTickers.length, 1) * 2)
      : Promise.resolve({ data: [] as ScoreRow[] }),
    openTickers.length > 0
      ? sb
          .from("concentration_history")
          .select("ticker,as_of,tax")
          .in("ticker", openTickers)
          .order("as_of", { ascending: false })
          .limit(Math.max(openTickers.length, 1) * 2)
      : Promise.resolve({ data: [] as TaxRow[] }),
  ]);

  const priceMap = latestPriceMap((priceRes.data ?? []) as PriceRow[]);
  const univMap = new Map(((univRes.data ?? []) as UniverseChoice[]).map((u) => [u.ticker, u]));
  const scoreMap = latestScoreMap((scoreRes.data ?? []) as ScoreRow[]);
  const taxMap = latestTaxMap((taxRes.data ?? []) as TaxRow[]);

  const positions: PositionRow[] = openDbRows.map((p) => {
    const price = priceMap.get(p.ticker) ?? null;
    const u = univMap.get(p.ticker) ?? fallbackUniverseRow(p.ticker);
    const score = scoreMap.get(p.ticker) ?? null;
    const tax = taxMap.get(p.ticker) ?? null;
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
      composite: score?.composite != null ? Number(score.composite) : null,
      tier: score?.tier ?? null,
      concentration_tax: tax?.tax != null ? Number(tax.tax) : null,
      realized_pl: p.realized_pl != null ? Number(p.realized_pl) : 0,
      realized_proceeds: p.realized_proceeds != null ? Number(p.realized_proceeds) : 0,
      original_shares: p.original_shares != null ? Number(p.original_shares) : null,
    };
  });

  const closed_positions: ClosedPositionRow[] = closedDbRows.map((p) => {
    const u = univMap.get(p.ticker) ?? fallbackUniverseRow(p.ticker);
    const realized_pl = p.realized_pl != null ? Number(p.realized_pl) : 0;
    const realized_proceeds = p.realized_proceeds != null ? Number(p.realized_proceeds) : 0;
    const cost_basis = Number(p.cost_basis);
    // shares_sold = original_shares (every share is sold by the time
    // closed_at is set). Legacy rows closed via the old closePosition flow
    // have original_shares=NULL — fall back to the remaining shares value
    // they were closed with (typically equals what they were holding then).
    const original_shares =
      p.original_shares != null ? Number(p.original_shares) : Number(p.shares);
    const shares_sold = original_shares;
    const total_cost = cost_basis * shares_sold;
    const realized_pl_pct = total_cost > 0 ? realized_pl / total_cost : null;
    return {
      ticker: p.ticker,
      name: u.name,
      layer: u.layer,
      layer_label: u.layer_label,
      cost_basis,
      shares_sold,
      original_shares,
      exit_price: p.exit_price != null ? Number(p.exit_price) : null,
      closed_at: String(p.closed_at),
      opened_at: p.opened_at,
      realized_pl,
      realized_proceeds,
      realized_pl_pct,
    };
  });

  const [spySnap, vixSnap] = await Promise.all([fetchSpySnapshot(sb), fetchVixSnapshot(sb)]);

  return finalizeSnapshot(positions, closed_positions, settings, spySnap, vixSnap, true);
}

/**
 * Universe options for the position-add select.
 *
 * Async now because we join latest close from prices_raw — the form needs
 * this to (a) auto-fill cost_basis when opening today, (b) compute shares
 * from a dollar amount in Dollar-mode.
 */
export async function getUniverseChoices(): Promise<UniverseChoice[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const { data: univData } = await sb
    .from("universe")
    .select("ticker,name,layer,layer_label")
    .eq("is_active", true)
    .eq("kind", "investable") // investable only (excludes benchmark/macro/hp1)
    .order("ticker");
  const univ = (univData ?? []) as { ticker: string; name: string; layer: number; layer_label: string }[];
  if (univ.length === 0) return [];

  // One round-trip for latest closes — limit is loose because we only
  // need the most-recent date per ticker (filtered client-side via
  // latestPriceMap below).
  const tickers = univ.map((u) => u.ticker);
  const { data: priceData } = await sb
    .from("prices_raw")
    .select("ticker,date,close")
    .in("ticker", tickers)
    .order("date", { ascending: false })
    .limit(tickers.length * 3);
  const priceMap = latestPriceMap((priceData ?? []) as PriceRow[]);

  return univ.map((u) => {
    const price = priceMap.get(u.ticker);
    return {
      ticker: u.ticker,
      name: u.name,
      layer: u.layer,
      layer_label: u.layer_label,
      latest_price: price?.close != null ? Number(price.close) : null,
      latest_price_as_of: price?.date ?? null,
    };
  });
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

function latestScoreMap(rows: ScoreRow[]): Map<string, ScoreRow> {
  const out = new Map<string, ScoreRow>();
  for (const r of rows) {
    const existing = out.get(r.ticker);
    if (!existing || r.as_of > existing.as_of) out.set(r.ticker, r);
  }
  return out;
}

function latestTaxMap(rows: TaxRow[]): Map<string, TaxRow> {
  const out = new Map<string, TaxRow>();
  for (const r of rows) {
    const existing = out.get(r.ticker);
    if (!existing || r.as_of > existing.as_of) out.set(r.ticker, r);
  }
  return out;
}

interface SpySnap {
  spy_close: number | null;
  spy_close_prior: number | null;
  spy_as_of: string | null;
}

interface VixSnap {
  /** Last 3 daily closes, ordered newest → oldest. */
  recent_closes: number[];
  vix_as_of: string | null;
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

async function fetchVixSnapshot(sb: NonNullable<Awaited<ReturnType<typeof getSupabaseServer>>>): Promise<VixSnap> {
  const { data } = await sb
    .from("prices_raw")
    .select("date,close")
    .eq("ticker", "^VIX")
    .order("date", { ascending: false })
    .limit(3);
  const rows = (data ?? []) as { date: string; close: number | null }[];
  if (rows.length === 0) return { recent_closes: [], vix_as_of: null };
  return {
    recent_closes: rows.map((r) => (r.close != null ? Number(r.close) : Number.NaN)).filter((n) => Number.isFinite(n)),
    vix_as_of: rows[0].date,
  };
}

function finalizeSnapshot(
  positions: PositionRow[],
  closed_positions: ClosedPositionRow[],
  settings: { total_capital: number; target_reserve: number },
  spy: SpySnap,
  vix: VixSnap,
  envConfigured: boolean,
): PortfolioSnapshot {
  let total_deployed = 0;
  let total_market_value = 0;
  let total_realized_pl_open = 0;
  let total_realized_proceeds_open = 0;
  const position_triggers: PositionTrigger[] = [];

  for (const p of positions) {
    const cost = p.cost_basis * p.shares;
    total_deployed += cost;
    total_realized_pl_open += p.realized_pl;
    total_realized_proceeds_open += p.realized_proceeds;
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

  let total_realized_pl_closed = 0;
  let total_realized_proceeds_closed = 0;
  for (const c of closed_positions) {
    total_realized_pl_closed += c.realized_pl;
    total_realized_proceeds_closed += c.realized_proceeds;
  }

  const total_realized_pl = total_realized_pl_open + total_realized_pl_closed;
  const total_realized_proceeds = total_realized_proceeds_open + total_realized_proceeds_closed;

  const total_pl = total_market_value - total_deployed;
  const total_pl_pct = total_deployed > 0 ? total_pl / total_deployed : 0;
  // Reserve formula (THS-103): capital + realized_pl − deployed-in-open.
  // Realized P&L reconciles past sales: profit grows the pool, loss shrinks
  // it. Open deployments still tie up cost basis. The cost basis component
  // of past sales is already returned (it was subtracted from deployed when
  // shares dropped to zero); realized_pl is the net delta on top.
  const reserve_actual = settings.total_capital + total_realized_pl - total_deployed;
  const market_triggers = computeMarketTriggers(spy, vix);

  // Sum concentration tax across held names where the engine has computed
  // it. Null only when no held name has a row yet — distinguishes pre-engine
  // from "engine has run, total drag is 0".
  let taxSum = 0;
  let taxCount = 0;
  for (const p of positions) {
    if (p.concentration_tax != null) {
      taxSum += p.concentration_tax;
      taxCount += 1;
    }
  }
  const portfolio_concentration_tax = taxCount > 0 ? taxSum : null;

  return {
    positions,
    closed_positions,
    settings,
    total_deployed,
    total_market_value,
    total_pl,
    total_pl_pct,
    total_realized_pl,
    total_realized_proceeds,
    reserve_actual,
    position_triggers,
    market_triggers,
    spy_close: spy.spy_close,
    spy_close_prior: spy.spy_close_prior,
    spy_as_of: spy.spy_as_of,
    empty: positions.length === 0 && closed_positions.length === 0,
    envConfigured,
    portfolio_concentration_tax,
  };
}

function computeMarketTriggers(spy: SpySnap, vix: VixSnap): MarketTrigger[] {
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

  // Trigger 2b — VIX ≥ 25 for 3 consecutive days.
  if (vix.recent_closes.length >= 3) {
    const [d0, d1, d2] = vix.recent_closes;
    const fired = d0 >= VIX_LEVEL_TRIGGER && d1 >= VIX_LEVEL_TRIGGER && d2 >= VIX_LEVEL_TRIGGER;
    triggers.push({
      kind: "vix_sustained",
      fired,
      detail: fired
        ? `VIX ≥ ${VIX_LEVEL_TRIGGER} for 3 days (${d0.toFixed(1)} / ${d1.toFixed(1)} / ${d2.toFixed(1)}, latest ${vix.vix_as_of}).`
        : `VIX last 3 closes: ${d0.toFixed(1)} / ${d1.toFixed(1)} / ${d2.toFixed(1)} (need all ≥ ${VIX_LEVEL_TRIGGER}; latest ${vix.vix_as_of}).`,
    });
  } else {
    triggers.push({
      kind: "vix_sustained",
      fired: false,
      detail:
        vix.recent_closes.length === 0
          ? "Awaiting VIX price ingestion (no prices_raw rows for ^VIX yet)."
          : `Awaiting VIX history (need 3 closes; have ${vix.recent_closes.length}, latest ${vix.vix_as_of}).`,
    });
  }

  return triggers;
}

function emptySnapshot(envConfigured: boolean): PortfolioSnapshot {
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
    settings: DEFAULT_SETTINGS,
    portfolio_concentration_tax: null,
  };
}

function emptyAggregate(settings: { total_capital: number; target_reserve: number }) {
  return {
    positions: [] as PositionRow[],
    closed_positions: [] as ClosedPositionRow[],
    total_deployed: 0,
    total_market_value: 0,
    total_pl: 0,
    total_pl_pct: 0,
    total_realized_pl: 0,
    total_realized_proceeds: 0,
    reserve_actual: settings.total_capital,
    position_triggers: [] as PositionTrigger[],
  };
}

function fallbackUniverseRow(ticker: string): UniverseChoice {
  return {
    ticker,
    name: ticker,
    layer: 0,
    layer_label: "Unknown",
    latest_price: null,
    latest_price_as_of: null,
  };
}

function formatPct(p: number): string {
  return `${(p * 100).toFixed(2)}%`;
}

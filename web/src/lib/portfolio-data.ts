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
  VIX_LEVEL_TRIGGER,
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
    const [spySnap, vixSnap] = await Promise.all([fetchSpySnapshot(sb), fetchVixSnapshot(sb)]);
    return finalizeSnapshot([], settings, spySnap, vixSnap, true, false);
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

  const [spySnap, vixSnap] = await Promise.all([fetchSpySnapshot(sb), fetchVixSnapshot(sb)]);

  return finalizeSnapshot(positions, settings, spySnap, vixSnap, true, false);
}

/**
 * Universe options for the position-add select.
 *
 * Async now because we join latest close from prices_raw — the form needs
 * this to (a) auto-fill cost_basis when opening today, (b) compute shares
 * from a dollar amount in Dollar-mode. Falls back to fixture prices when
 * env unset OR when a ticker has no prices_raw row yet.
 */
export async function getUniverseChoices(): Promise<UniverseChoice[]> {
  const sb = await getSupabaseServer();
  if (!sb) {
    return FIXTURE_UNIVERSE.filter((u) => u.layer >= 1).map((u) => ({
      ticker: u.ticker,
      name: u.name,
      layer: u.layer,
      layer_label: u.layer_label,
      latest_price: fixtureClose(u.ticker),
      latest_price_as_of: FIXTURE_PRICES_AS_OF,
    }));
  }

  const { data: univData } = await sb
    .from("universe")
    .select("ticker,name,layer,layer_label")
    .eq("is_active", true)
    .order("ticker");
  const univ = (univData ?? []) as { ticker: string; name: string; layer: number; layer_label: string }[];
  if (univ.length === 0) {
    // RLS blocked or table empty — surface the fixture universe so the form
    // still works locally (unauthenticated dev requests) and isn't dead in
    // an edge case where universe is unexpectedly empty in prod.
    return FIXTURE_UNIVERSE.filter((u) => u.layer >= 1).map((u) => ({
      ticker: u.ticker,
      name: u.name,
      layer: u.layer,
      layer_label: u.layer_label,
      latest_price: fixtureClose(u.ticker),
      latest_price_as_of: FIXTURE_PRICES_AS_OF,
    }));
  }

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

/** Deterministic per-ticker close used in fixture mode. Keeps the
 * dollar-amount math stable across renders so the form preview doesn't
 * jitter when env is unset. */
function fixtureClose(ticker: string): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) >>> 0;
  return Math.round(((h % 4000) / 10 + 25) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Fixture-positions seed (lambo review §2.4 #1)
// ---------------------------------------------------------------------------

/**
 * Deterministic 12-position demo book spanning all 5 universe layers. Used
 * only when /portfolio is invoked with `?seed=fixture-positions` so the full
 * /lambo render (AggregateBar, PositionsTable, ReservePanel, triggers, rail)
 * can be reviewed without standing up live Supabase data. One position (AMD
 * at -8%) intentionally fires the position-drawdown trigger so the rail's
 * trigger surface is exercised in the demo path.
 *
 * Composition by layer (matches spec §5.4 mix):
 *   L1 Compute (3) · L2 Hyperscaler (3) · L3 App (2) · L4 Power (2) · L5 Incumbent (2)
 *
 * No DB call — this is pure synthetic data tagged `synthetic_prices: true`
 * so the empty-state branch + "data pending" affordances stay honest.
 */
interface FixtureBookEntry {
  ticker: string;
  shares: number;
  cost_basis: number;
  current_price: number;
  opened_at: string;
  notes: string | null;
}

const FIXTURE_BOOK: FixtureBookEntry[] = [
  { ticker: "NVDA",  shares:  30, cost_basis: 110.00, current_price: 145.20, opened_at: "2026-02-04", notes: "Compute spine — sized large; trim at +40%." },
  { ticker: "TSM",   shares:  60, cost_basis: 160.00, current_price: 178.50, opened_at: "2026-01-22", notes: null },
  { ticker: "AMD",   shares:  50, cost_basis: 168.00, current_price: 154.30, opened_at: "2026-03-14", notes: "Re-eval thesis if -10% from cost." },
  { ticker: "MSFT",  shares:  20, cost_basis: 380.00, current_price: 425.10, opened_at: "2026-01-10", notes: null },
  { ticker: "GOOGL", shares:  40, cost_basis: 175.00, current_price: 192.60, opened_at: "2026-02-18", notes: null },
  { ticker: "META",  shares:  15, cost_basis: 540.00, current_price: 590.20, opened_at: "2026-02-26", notes: null },
  { ticker: "CRWD",  shares:  18, cost_basis: 360.00, current_price: 340.50, opened_at: "2026-04-02", notes: null },
  { ticker: "PLTR",  shares: 120, cost_basis:  28.50, current_price:  35.80, opened_at: "2026-01-08", notes: "L3 App high-conviction." },
  { ticker: "VST",   shares:  35, cost_basis: 175.00, current_price: 198.40, opened_at: "2026-03-05", notes: null },
  { ticker: "CEG",   shares:  25, cost_basis: 215.00, current_price: 232.70, opened_at: "2026-03-19", notes: null },
  { ticker: "AAPL",  shares:  35, cost_basis: 198.00, current_price: 205.40, opened_at: "2026-01-15", notes: null },
  { ticker: "ADBE",  shares:  10, cost_basis: 520.00, current_price: 488.60, opened_at: "2026-04-21", notes: null },
];

const FIXTURE_PRICES_AS_OF = "2026-05-17";

export function getFixturePortfolioSnapshot(): PortfolioSnapshot {
  const settings = DEFAULT_SETTINGS;
  const positions: PositionRow[] = FIXTURE_BOOK.map((p) => {
    const u = FIXTURE_INDEX[p.ticker] ?? fallbackUniverseRow(p.ticker);
    return {
      ticker: p.ticker,
      shares: p.shares,
      cost_basis: p.cost_basis,
      opened_at: p.opened_at,
      closed_at: null,
      notes: p.notes,
      current_price: p.current_price,
      current_price_as_of: FIXTURE_PRICES_AS_OF,
      name: u.name,
      layer: u.layer,
      layer_label: u.layer_label,
    };
  });

  // Synthetic SPY: prior-close → current-close at -2% (no SPY trigger fired
  // in demo — keeps the rail honest about which triggers are exercising).
  // Position-drawdown trigger DOES fire (AMD at -8%).
  const spy: SpySnap = { spy_close: 524.30, spy_close_prior: 534.80, spy_as_of: FIXTURE_PRICES_AS_OF };
  const vix: VixSnap = { recent_closes: [18.4, 17.9, 18.1], vix_as_of: FIXTURE_PRICES_AS_OF };

  return finalizeSnapshot(positions, settings, spy, vix, true, true);
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
  settings: { total_capital: number; target_reserve: number },
  spy: SpySnap,
  vix: VixSnap,
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
  const market_triggers = computeMarketTriggers(spy, vix);

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

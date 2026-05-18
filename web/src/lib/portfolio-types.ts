/**
 * Pure type / constant module for portfolio data. Safe to import from
 * client components — does not pull in the server-only Supabase client.
 *
 * Matching server-only fetcher: `portfolio-data.ts`.
 */
import type { SeedRow } from "./universe-fixture";

/** Position drawdown threshold (% from cost basis) that fires trigger 1. */
export const POSITION_DRAWDOWN_TRIGGER = -0.07;

/** SPY single-day drop threshold (close vs prior close) that fires trigger 2a. */
export const SPY_DAILY_DROP_TRIGGER = -0.05;

/** VIX level that, when sustained ≥ this many days, fires trigger 2b. */
export const VIX_LEVEL_TRIGGER = 25;
export const VIX_SUSTAINED_DAYS = 3;

export interface PortfolioSettings {
  total_capital: number;
  target_reserve: number;
}

export interface PositionRow {
  ticker: string;
  shares: number;
  cost_basis: number;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  /** Joined: latest known close from prices_raw or fixture. null if no price data. */
  current_price: number | null;
  /** Joined: as_of of the current_price. */
  current_price_as_of: string | null;
  /** Joined: universe row (name, layer, layer_label). */
  name: string;
  layer: number;
  layer_label: string;
}

export interface PositionTrigger {
  ticker: string;
  pct_drawdown: number;
  market_value: number;
  cost_total: number;
}

export interface MarketTrigger {
  kind: "spy_daily_drop" | "vix_sustained";
  fired: boolean;
  /** Human-readable explanation rendered in the alert chip. */
  detail: string;
}

export interface PortfolioSnapshot {
  positions: PositionRow[];
  settings: PortfolioSettings;
  total_deployed: number;
  total_market_value: number;
  total_pl: number;
  total_pl_pct: number;
  reserve_actual: number;
  /** Triggered positions (≥7% drawdown from cost basis). */
  position_triggers: PositionTrigger[];
  market_triggers: MarketTrigger[];
  /** Latest SPY close — used to render trigger 2a state. */
  spy_close: number | null;
  spy_close_prior: number | null;
  spy_as_of: string | null;
  /** True when Supabase env is unset OR when no positions exist yet. */
  empty: boolean;
  envConfigured: boolean;
  /** True when current_price columns came from a deterministic fixture. */
  synthetic_prices: boolean;
}

/** Available universe choices for the "add position" select. */
export interface UniverseChoice extends Pick<SeedRow, "ticker" | "name" | "layer" | "layer_label"> {
  /** Latest close from prices_raw — used for Dollar-amount → shares math and
   * cost-basis auto-fill when opening a position today. null when no price
   * has been ingested yet for this ticker. */
  latest_price: number | null;
  latest_price_as_of: string | null;
}

/** Compact form-prefill snapshot for an already-held position. The
 * AddPositionForm reads this map when an existing ticker is re-selected
 * so all fields hydrate from the current row rather than blank. */
export interface HeldPositionPrefill {
  ticker: string;
  shares: number;
  cost_basis: number;
  opened_at: string;
  notes: string | null;
}

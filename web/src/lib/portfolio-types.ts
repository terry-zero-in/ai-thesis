/**
 * Pure type / constant module for portfolio data. Safe to import from
 * client components — does not pull in the server-only Supabase client.
 *
 * Matching server-only fetcher: `portfolio-data.ts`.
 */
import type { Tier } from "./universe-data";

export interface SeedRow {
  ticker: string;
  name: string;
  layer: number;
  layer_label: string;
}

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
  /** Joined: latest composite from scores_history (post-macro). null pre-engine. */
  composite: number | null;
  /** Joined: latest tier from scores_history. null pre-engine. */
  tier: Tier | null;
  /** Joined: latest concentration_history.tax for this ticker (-15..0 range). null
   * when concentration engine hasn't computed for this ticker yet. */
  concentration_tax: number | null;
  /** Cumulative realized P&L from prior sales on this position (THS-103). */
  realized_pl: number;
  /** Cumulative gross proceeds from prior sales (THS-103). */
  realized_proceeds: number;
  /** Pre-first-sale share count. null when never sold (shares is original). */
  original_shares: number | null;
}

/** Closed-position row — shape mirrors PositionRow but trimmed to the fields
 *  the closed-positions section actually renders. realized_* are canonical;
 *  exit_price is the last sale price (display). */
export interface ClosedPositionRow {
  ticker: string;
  name: string;
  layer: number;
  layer_label: string;
  cost_basis: number;
  /** Total shares sold across all sales on this position. */
  shares_sold: number;
  /** Pre-first-sale share count (= shares_sold when fully closed). */
  original_shares: number;
  exit_price: number | null;
  /** Date of the final sale that fully closed the position. */
  closed_at: string;
  opened_at: string;
  realized_pl: number;
  realized_proceeds: number;
  /** realized_pl / (cost_basis * shares_sold) — null when cost basis is zero. */
  realized_pl_pct: number | null;
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
  /** Fully-closed positions (shares=0, closed_at set), newest sale first. */
  closed_positions: ClosedPositionRow[];
  settings: PortfolioSettings;
  total_deployed: number;
  total_market_value: number;
  total_pl: number;
  total_pl_pct: number;
  /** Sum of realized_pl across ALL positions (open + closed). */
  total_realized_pl: number;
  /** Sum of realized_proceeds across ALL positions (open + closed). */
  total_realized_proceeds: number;
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
  /** Sum of per-position concentration_tax across all held names (≤ 0).
   * Surfaces total engine drag from over-concentration. Null when no
   * concentration_history rows joined (pre-engine or env unset). */
  portfolio_concentration_tax: number | null;
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

/** Compact prefill snapshot for the SellDrawer (THS-103). Provides the
 * currently-held share count + cost basis + opened_at so the sell form can
 * default + validate without an extra DB round-trip. */
export interface SellablePositionPrefill {
  ticker: string;
  name: string;
  shares: number;
  cost_basis: number;
  opened_at: string;
  current_price: number | null;
  current_price_as_of: string | null;
}

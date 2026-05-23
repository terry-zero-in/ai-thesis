/**
 * Server-only derivation for the / (Dashboard) route.
 *
 * Wholly composed from the universe snapshot — no new DB query needed.
 * Adds tier counts (current + prior week deltas), top movers, tier
 * crossings, and the macro multiplier state.
 */
import { type Tier, type UniverseRow } from "./universe-data";
import { getLatestUniverseScoresServer } from "./universe-data-server";
import { getSupabaseServer } from "./supabase/server";

const INSIDER_RAIL_LOOKBACK_DAYS = 14;
/** Distinct (ticker, side) groups shown in the rail after de-dupe. */
const INSIDER_RAIL_LIMIT = 5;
/**
 * Raw-row ceiling for the Supabase query. We over-pull so the dedupe pass
 * in `getRecentInsider` has enough material to surface 5 distinct groups
 * even when a single ticker dominates the window (e.g., 3+ ARM filings on
 * the same day eating the 5-slot rail pre-dedupe).
 */
const INSIDER_QUERY_LIMIT = 40;

const TIER_ORDER: Tier[] = ["High", "Medium", "Low", "Avoid"];

export interface DashboardTierCounts {
  tier: Tier;
  current: number;
  prior: number;
  delta: number; // current - prior
}

export interface DashboardMover {
  ticker: string;
  layer: number;
  layer_label: string;
  composite: number | null;
  final_score: number | null;
  prior_composite: number | null;
  delta: number;
  tier: Tier | null;
  /** Factor scores carried through so MoverRow can render Score Math (THS-73). */
  q: number | null;
  g: number | null;
  v: number | null;
  aiq: number | null;
  /** Macro state captured at composite computation time. */
  macroGatesHit: number;
  macroMultiplier: number;
  driver: { factor: "Q" | "G" | "V" | "AIQ"; delta: number } | null;
}

export interface DashboardCrossing {
  ticker: string;
  layer_label: string;
  prior_tier: Tier | null;
  current_tier: Tier | null;
  delta: number | null;
  direction: "up" | "down";
}

export interface DashboardScoreLite {
  composite: number | null;
  final_score: number | null;
  tier: Tier | null;
}

export interface DashboardSnapshot {
  asOf: string | null;
  synthetic: boolean;
  tiers: DashboardTierCounts[];
  macroGatesHit: number;
  macroMultiplier: number;
  topWinners: DashboardMover[];
  topLosers: DashboardMover[];
  crossings: DashboardCrossing[];
  universeSize: number;
  scoredCount: number;
  /**
   * Minimal per-ticker score map keyed by symbol. Lets the dashboard's
   * TopPositionsList render a thesis-grade column without re-fetching the
   * universe (the rows are already in memory while building this snapshot).
   */
  scoresByTicker: Record<string, DashboardScoreLite>;
}

const MOVERS_LIMIT = 5;

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const snap = await getLatestUniverseScoresServer();
  const rows: UniverseRow[] = snap.rows;

  // Tier counts current vs prior week (prior tier derived from prior_composite
  // using the same cutpoints as classifyTier in composite.ts).
  const currentByTier = new Map<Tier, number>();
  const priorByTier = new Map<Tier, number>();
  for (const t of TIER_ORDER) {
    currentByTier.set(t, 0);
    priorByTier.set(t, 0);
  }
  for (const r of rows) {
    if (r.tier) currentByTier.set(r.tier, (currentByTier.get(r.tier) ?? 0) + 1);
    const pt = derivePriorTier(r.prior_composite);
    if (pt) priorByTier.set(pt, (priorByTier.get(pt) ?? 0) + 1);
  }
  const tiers: DashboardTierCounts[] = TIER_ORDER.map((t) => {
    const current = currentByTier.get(t) ?? 0;
    const prior = priorByTier.get(t) ?? 0;
    return { tier: t, current, prior, delta: current - prior };
  });

  // Macro state pulled from any scored row (all share the same gauges).
  const sample = rows.find((r) => r.final_score != null) ?? rows[0];

  // Top movers: largest abs(delta) split into winners / losers, scored only.
  const moves: DashboardMover[] = [];
  for (const r of rows) {
    if (r.delta == null || !Number.isFinite(r.delta)) continue;
    moves.push({
      ticker: r.ticker,
      layer: r.layer,
      layer_label: r.layer_label,
      composite: r.composite,
      final_score: r.final_score,
      prior_composite: r.prior_composite,
      delta: r.delta,
      tier: r.tier,
      q: r.q,
      g: r.g,
      v: r.v,
      aiq: r.aiq,
      macroGatesHit: r.macro_gates_hit,
      macroMultiplier: r.macro_multiplier,
      driver: deriveDriver(r),
    });
  }
  const topWinners = moves.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, MOVERS_LIMIT);
  const topLosers = moves.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, MOVERS_LIMIT);

  // Tier crossings: prior vs current tier differs.
  const crossings: DashboardCrossing[] = [];
  for (const r of rows) {
    const pt = derivePriorTier(r.prior_composite);
    const ct = r.tier;
    if (!pt || !ct || pt === ct) continue;
    const priorIdx = TIER_ORDER.indexOf(pt);
    const currIdx = TIER_ORDER.indexOf(ct);
    crossings.push({
      ticker: r.ticker,
      layer_label: r.layer_label,
      prior_tier: pt,
      current_tier: ct,
      delta: r.delta,
      direction: currIdx < priorIdx ? "up" : "down", // High=0, Avoid=3 — lower idx is better
    });
  }
  crossings.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));

  const scoredCount = rows.filter((r) => r.final_score != null).length;

  const scoresByTicker: Record<string, DashboardScoreLite> = {};
  for (const r of rows) {
    scoresByTicker[r.ticker] = {
      composite: r.composite,
      final_score: r.final_score,
      tier: r.tier,
    };
  }

  return {
    asOf: snap.asOf,
    synthetic: snap.synthetic,
    tiers,
    macroGatesHit: sample?.macro_gates_hit ?? 0,
    macroMultiplier: sample?.macro_multiplier ?? 1.0,
    topWinners,
    topLosers,
    crossings,
    universeSize: rows.length,
    scoredCount,
    scoresByTicker,
  };
}

/**
 * Pick the factor (Q / G / V / AIQ) whose 7-day delta is largest in
 * magnitude — answers "why did composite move?" inline on the dashboard
 * mover row. Skips factors where either current or prior is null.
 * Returns null if no factor has a usable delta.
 */
function deriveDriver(r: UniverseRow): DashboardMover["driver"] {
  const factors: { factor: "Q" | "G" | "V" | "AIQ"; curr: number | null; prior: number | null }[] = [
    { factor: "Q", curr: r.q, prior: r.prior_q },
    { factor: "G", curr: r.g, prior: r.prior_g },
    { factor: "V", curr: r.v, prior: r.prior_v },
    { factor: "AIQ", curr: r.aiq, prior: r.prior_aiq },
  ];
  let best: { factor: "Q" | "G" | "V" | "AIQ"; delta: number } | null = null;
  for (const f of factors) {
    if (f.curr == null || f.prior == null) continue;
    const delta = Number((f.curr - f.prior).toFixed(1));
    if (delta === 0) continue;
    if (best == null || Math.abs(delta) > Math.abs(best.delta)) {
      best = { factor: f.factor, delta };
    }
  }
  return best;
}

/**
 * Recent insider activity for the dashboard rail (§6 spec "Insider today").
 *
 * Real-data path replaces the prior THS-66 ghost. We query the last 14 days
 * of P (purchase) and S (sale) transactions across the universe and surface
 * the most recent N — section title in the rail is "Insider · recent" so the
 * window is honest (Form 4 freshness varies; "today" overpromises).
 *
 * Returns an empty array when env is unset or no qualifying rows exist —
 * the rail renders an honest empty state with no ticket-ID exposure.
 */
export interface DashboardInsiderRow {
  ticker: string;
  /** Most recent transaction_date across grouped filings. */
  transaction_date: string;
  /**
   * Most recent insider on this (ticker, side) group. Kept for
   * downstream consumers; rail UI shows only ticker + side + aggregate
   * shares + filing count + days-ago.
   */
  insider_name: string;
  insider_title: string | null;
  transaction_code: "P" | "S" | string;
  /** Summed shares across the grouped filings (same side only). */
  shares: number | null;
  /** Summed $ value across the grouped filings. */
  transaction_value: number | null;
  /**
   * Count of raw Form 4 filings collapsed into this row. 1 = single
   * filing (no "(N filings)" suffix needed); >1 means the rail row is
   * an aggregation of N same-ticker, same-side events.
   */
  filing_count: number;
}

/**
 * Raw shape from Supabase before dedupe — internal-only.
 */
interface InsiderRawRow {
  ticker: string;
  transaction_date: string;
  insider_name: string;
  insider_title: string | null;
  transaction_code: "P" | "S" | string;
  shares: number | null;
  transaction_value: number | null;
}

/**
 * Recent insider activity in a 24-hour window — for the Dashboard right
 * rail "Insider 24h" section (THS-74). Tighter window than getRecentInsider
 * (which is a 14-day rail digest); these are "what hit overnight."
 *
 * Returns raw rows ordered date-desc, capped to a small N so the rail
 * stays scannable. No dedupe — operator wants per-filing density when
 * the window is this tight (a cluster of 4 same-day filings IS the signal).
 */
export interface DashboardInsider24hRow {
  ticker: string;
  transaction_date: string;
  insider_name: string;
  insider_title: string | null;
  transaction_code: "P" | "S" | string;
  shares: number | null;
  transaction_value: number | null;
}

const INSIDER_24H_LIMIT = 6;

export async function getInsider24h(): Promise<DashboardInsider24hRow[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  // 24h window keyed on filing_date (the actual ingestion timestamp from
  // settings-data.ts) — falls back to transaction_date when filing_date
  // isn't selectable. We use filing_date >= now() - 24h to honor the spec
  // wording ("recent insider filings from insider_form4_raw where
  // filing_date >= now() - interval '24 hours'").
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const res = await sb
    .from("insider_form4_raw")
    .select("ticker,transaction_date,insider_name,insider_title,transaction_code,shares,transaction_value,filing_date")
    .gte("filing_date", cutoff)
    .in("transaction_code", ["P", "S"])
    .order("filing_date", { ascending: false })
    .limit(INSIDER_24H_LIMIT);
  return ((res.data ?? []) as DashboardInsider24hRow[]).map((r) => ({
    ticker: r.ticker,
    transaction_date: r.transaction_date,
    insider_name: r.insider_name,
    insider_title: r.insider_title,
    transaction_code: r.transaction_code,
    shares: r.shares,
    transaction_value: r.transaction_value,
  }));
}

export async function getRecentInsider(): Promise<DashboardInsiderRow[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const today = new Date().toISOString().slice(0, 10);
  const fromIso = isoDateMinusDays(today, INSIDER_RAIL_LOOKBACK_DAYS);
  const res = await sb
    .from("insider_form4_raw")
    .select("ticker,transaction_date,insider_name,insider_title,transaction_code,shares,transaction_value")
    .gte("transaction_date", fromIso)
    .in("transaction_code", ["P", "S"])
    .order("transaction_date", { ascending: false })
    .limit(INSIDER_QUERY_LIMIT);
  const raw = (res.data ?? []) as InsiderRawRow[];

  // De-dupe pass: group by (ticker, transaction_code). Buys and sells
  // for the same ticker stay as separate rows (semantically distinct
  // events). Within a group: sum shares + value, keep the most-recent
  // date + insider, count the filings.
  const groups = new Map<string, DashboardInsiderRow>();
  for (const r of raw) {
    const key = `${r.ticker}:${r.transaction_code}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        ticker: r.ticker,
        transaction_date: r.transaction_date,
        insider_name: r.insider_name,
        insider_title: r.insider_title,
        transaction_code: r.transaction_code,
        shares: r.shares,
        transaction_value: r.transaction_value,
        filing_count: 1,
      });
    } else {
      // Raw rows come date-desc, so the first row in a group is the
      // most recent — leave existing.transaction_date / insider_name
      // alone. Aggregate the numerics; null + N = N (no contamination).
      existing.shares = sumNullable(existing.shares, r.shares);
      existing.transaction_value = sumNullable(existing.transaction_value, r.transaction_value);
      existing.filing_count += 1;
    }
  }

  // Preserve date-desc order across groups by sorting on most-recent
  // transaction_date (the first-row date kept in each group).
  return Array.from(groups.values())
    .sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1))
    .slice(0, INSIDER_RAIL_LIMIT);
}

function sumNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

function isoDateMinusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function derivePriorTier(composite: number | null): Tier | null {
  if (composite == null || !Number.isFinite(composite)) return null;
  if (composite >= 75) return "High";
  if (composite >= 60) return "Medium";
  if (composite >= 45) return "Low";
  return "Avoid";
}

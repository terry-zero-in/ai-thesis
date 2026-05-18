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
const INSIDER_RAIL_LIMIT = 5;

const TIER_ORDER: Tier[] = ["High", "Medium", "Low", "Avoid"];

export interface DashboardTierCounts {
  tier: Tier;
  current: number;
  prior: number;
  delta: number; // current - prior
}

export interface DashboardMover {
  ticker: string;
  layer_label: string;
  final_score: number | null;
  prior_composite: number | null;
  delta: number;
  tier: Tier | null;
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
      layer_label: r.layer_label,
      final_score: r.final_score,
      prior_composite: r.prior_composite,
      delta: r.delta,
      tier: r.tier,
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
  transaction_date: string;
  insider_name: string;
  insider_title: string | null;
  transaction_code: "P" | "S" | string;
  shares: number | null;
  transaction_value: number | null;
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
    .limit(INSIDER_RAIL_LIMIT);
  return (res.data ?? []) as DashboardInsiderRow[];
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

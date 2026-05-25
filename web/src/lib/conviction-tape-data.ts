/**
 * Server-only data layer for the Conviction Tape (Lambo Pass §G feature 2).
 *
 * Unions four signal sources, ranks them, caps the output at 5 items:
 *   1. Recent decisions/alerts   — tier changes + insider clusters from
 *                                  getAlertsSnapshot() (top of as_of-desc list).
 *   2. Score movers (7d)         — top |Δ| from getDashboardSnapshot().
 *   3. Regime gate proximity     — any gauge within 10pts of its next gate.
 *   4. Portfolio trigger proxim. — open positions ≤ -10% P&L (within 5pts of
 *                                  the -15% trim trigger, or already past it).
 *
 * Each source is wrapped in defensive try/catch so a single failed fetch
 * (RLS denial, missing table, empty env) contributes zero items rather
 * than throwing the entire dashboard render.
 *
 * Ranking: severity priority (danger > warning > watch > success > info),
 * then recency, then magnitude. Stable IDs (`{source}:{ticker|key}`) so
 * the localStorage pin in ConvictionTape survives recompute.
 *
 * Returns up to 5 items, possibly an empty array — the tape collapses to
 * null (0px) when items is empty, so empty days cost nothing.
 */
import type { TapeItem, TapeSeverity } from "@/components/conviction/ConvictionTape";
import { getAlertsSnapshot } from "./alerts-data";
import { getDashboardSnapshot, type DashboardMover } from "./dashboard-data";
import { getRegimeSnapshot } from "./regime-data";
import { getPortfolioSnapshot } from "./portfolio-data";
import {
  GAUGES,
  MULTIPLIER_BY_GATES,
  fmtGaugeValue,
  type GaugeKey,
  type MacroGaugeRow,
} from "./regime-types";
import type { AlertEvent } from "./alerts-types";
import type { PositionRow } from "./portfolio-types";

const MAX_ITEMS = 5;
const PER_SOURCE_CAP = 3;
const GATE_PROXIMITY_PTS = 10;
const TRIM_TRIGGER = -0.15; // -15% trim trigger per portfolio spec
const TRIGGER_PROXIMITY = 0.05; // surface at -10% (5pts shy of -15%)

const SEVERITY_RANK: Record<TapeSeverity, number> = {
  danger: 4,
  warning: 3,
  watch: 2,
  success: 1,
  info: 0,
};

interface RankedTapeItem extends TapeItem {
  /** Internal ranking metadata — stripped before return. */
  _rank: {
    severity: TapeSeverity;
    /** ISO date string, "" if unknown — used for recency tiebreak. */
    asOf: string;
    /** Absolute magnitude (delta/score/dist) — bigger wins. */
    magnitude: number;
  };
}

export async function getConvictionTapeItems(): Promise<TapeItem[]> {
  const [alerts, dash, regime, portfolio] = await Promise.allSettled([
    getAlertsSnapshot(),
    getDashboardSnapshot(),
    getRegimeSnapshot(),
    getPortfolioSnapshot(),
  ]);

  const candidates: RankedTapeItem[] = [];

  if (alerts.status === "fulfilled") {
    try {
      candidates.push(...fromAlerts(alerts.value.events).slice(0, PER_SOURCE_CAP));
    } catch {
      // Single source degrades silently — never break the dashboard.
    }
  }

  if (dash.status === "fulfilled") {
    try {
      const movers = [...dash.value.topWinners, ...dash.value.topLosers]
        .filter((m) => m.delta != null && Number.isFinite(m.delta))
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 2);
      candidates.push(...fromMovers(movers, dash.value.asOf));
    } catch {
      // ignore
    }
  }

  if (regime.status === "fulfilled") {
    try {
      const item = fromRegimeProximity(regime.value.latest, regime.value.gates_hit);
      if (item) candidates.push(item);
    } catch {
      // ignore
    }
  }

  if (portfolio.status === "fulfilled") {
    try {
      candidates.push(...fromPortfolioTriggers(portfolio.value.positions).slice(0, PER_SOURCE_CAP));
    } catch {
      // ignore
    }
  }

  // Rank + cap.
  candidates.sort(compareRanked);
  return candidates.slice(0, MAX_ITEMS).map(stripRank);
}

// ---------------------------------------------------------------------------
// Source 1 — Recent decisions / alerts (tier changes, insider clusters)
// ---------------------------------------------------------------------------

function fromAlerts(events: AlertEvent[]): RankedTapeItem[] {
  // events arrive sorted as_of desc from getAlertsSnapshot.
  const out: RankedTapeItem[] = [];
  for (const e of events) {
    if (e.acked_at) continue; // already actioned — don't re-surface
    if (e.kind === "tier_change") {
      const item = tierChangeItem(e);
      if (item) out.push(item);
    } else if (e.kind === "insider_cluster") {
      out.push(insiderClusterItem(e));
    }
    if (out.length >= PER_SOURCE_CAP) break;
  }
  return out;
}

function tierChangeItem(e: AlertEvent): RankedTapeItem | null {
  // Parse tier transition out of e.title: "ETN tier Medium → High"
  const m = e.title.match(/tier\s+(\w+)\s*[→\-]+>?\s*(\w+)/i);
  if (!m || !e.ticker) return null;
  const fromTier = m[1];
  const toTier = m[2];
  const tierRank: Record<string, number> = { High: 3, Medium: 2, Low: 1, Avoid: 0 };
  const fromIdx = tierRank[fromTier] ?? 2;
  const toIdx = tierRank[toTier] ?? 2;
  // Severity: downgrade → warning, upgrade → watch.
  const severity: TapeSeverity = toIdx < fromIdx ? "warning" : "watch";
  // Pull score deltas from detail line if present:
  //   "Final score 65.0 → 78.4."
  const scoreMatch = e.detail.match(/(?:final|score)\s+([\d.]+)\s*[→\-]+>?\s*([\d.]+)/i);
  let primary: string;
  if (scoreMatch) {
    const prior = parseFloat(scoreMatch[1]);
    const current = parseFloat(scoreMatch[2]);
    primary = `${e.ticker} tier ${fromTier} → ${toTier} · score ${current.toFixed(1)} · was ${prior.toFixed(1)} (7d)`;
  } else {
    primary = `${e.ticker} tier ${fromTier} → ${toTier}`;
  }
  return {
    id: `alert:tier_change:${e.ticker}:${e.as_of}`,
    severity,
    primary,
    actionLabel: "open ticker",
    actionHref: `/universe/${e.ticker}`,
    _rank: {
      severity,
      asOf: e.as_of,
      magnitude: Math.abs(toIdx - fromIdx) * 10,
    },
  };
}

function insiderClusterItem(e: AlertEvent): RankedTapeItem {
  // e.title format:
  //   "ETN insider BUY cluster — 4 insiders / $12.3M"
  const isBuy = /\bBUY\b/i.test(e.title);
  const primary = e.ticker ? `${e.ticker} insider ${isBuy ? "BUY" : "SELL"} cluster fired` : e.title;
  // Append the count/value bit if we can parse it.
  const meta = e.title.match(/(\d+)\s+insiders?\s*\/\s*\$([\d.]+)M/i);
  const fullPrimary = meta ? `${primary} · ${meta[1]} insiders · $${meta[2]}M` : primary;
  const severity: TapeSeverity = isBuy ? "info" : "warning";
  return {
    id: `alert:insider_cluster:${e.ticker ?? "_"}:${e.as_of}`,
    severity,
    primary: fullPrimary,
    actionLabel: e.ticker ? "open ticker" : "trace",
    actionHref: e.ticker ? `/universe/${e.ticker}` : "/decisions",
    _rank: {
      severity,
      asOf: e.as_of,
      magnitude: 5,
    },
  };
}

// ---------------------------------------------------------------------------
// Source 2 — Score movers (top 2 by |Δ|)
// ---------------------------------------------------------------------------

function fromMovers(movers: DashboardMover[], asOf: string | null): RankedTapeItem[] {
  const out: RankedTapeItem[] = [];
  for (const m of movers) {
    if (m.composite == null || m.prior_composite == null) continue;
    const absDelta = Math.abs(m.delta);
    // Severity scale: large positive → watch, large negative → warning if big,
    // info if magnitude is modest (<3 pts).
    let severity: TapeSeverity;
    if (m.delta > 0) {
      severity = absDelta >= 3 ? "watch" : "info";
    } else {
      severity = absDelta >= 5 ? "warning" : "info";
    }
    const arrow = m.delta > 0 ? "+" : "";
    const prior = m.prior_composite.toFixed(1);
    const current = m.composite.toFixed(1);
    const primary = `${m.ticker} composite ${prior} → ${current} (${arrow}${m.delta.toFixed(1)} · 7d)`;
    const driver = m.driver ? `${m.driver.factor} ${m.driver.delta > 0 ? "+" : ""}${m.driver.delta.toFixed(1)}` : undefined;
    out.push({
      id: `mover:${m.ticker}:${asOf ?? "current"}`,
      severity,
      primary,
      driver,
      actionLabel: "trace",
      actionHref: `/universe/${m.ticker}`,
      _rank: {
        severity,
        asOf: asOf ?? "",
        magnitude: absDelta,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Source 3 — Regime gate proximity
// ---------------------------------------------------------------------------

function fromRegimeProximity(
  latest: MacroGaugeRow | null,
  currentGates: number,
): RankedTapeItem | null {
  if (!latest) return null;
  // Find the closest non-fired gauge within GATE_PROXIMITY_PTS.
  let best: {
    key: GaugeKey;
    label: string;
    value: number;
    threshold: number;
    dist: number;
  } | null = null;
  for (const g of GAUGES) {
    const v = latest[g.key];
    if (v == null) continue;
    const dist = g.threshold - v;
    if (dist <= 0) continue; // already fired
    if (dist > GATE_PROXIMITY_PTS) continue;
    if (best == null || dist < best.dist) {
      best = { key: g.key, label: g.label, value: v, threshold: g.threshold, dist };
    }
  }
  if (!best) return null;
  const nextGates = Math.min(currentGates + 1, 3) as 0 | 1 | 2 | 3;
  const nextMult = MULTIPLIER_BY_GATES[nextGates];
  const shortLabel = best.key === "naaim" ? "NAAIM" : best.key === "aaii_3wk_spread" ? "AAII spread" : "F&G";
  const valueStr = fmtGaugeValue(best.value, best.key);
  const primary = `${shortLabel} ${valueStr} · ${best.dist.toFixed(1)} pts to next ${nextMult.toFixed(2)}× gate`;
  return {
    id: `regime:${best.key}:proximity`,
    severity: "watch",
    primary,
    actionLabel: "open regime",
    actionHref: "/regime",
    _rank: {
      severity: "watch",
      asOf: latest.as_of,
      magnitude: GATE_PROXIMITY_PTS - best.dist, // closer = bigger
    },
  };
}

// ---------------------------------------------------------------------------
// Source 4 — Portfolio trigger proximity
// ---------------------------------------------------------------------------

function fromPortfolioTriggers(positions: PositionRow[]): RankedTapeItem[] {
  const out: RankedTapeItem[] = [];
  for (const p of positions) {
    if (p.current_price == null || p.cost_basis <= 0) continue;
    const pct = (p.current_price - p.cost_basis) / p.cost_basis;
    // Within proximity of -15% trigger? Surface positions at ≤ -10%.
    if (pct > TRIM_TRIGGER + TRIGGER_PROXIMITY) continue;
    // Severity tiers:
    //   pct ≤ -15% → danger (already past trigger)
    //   pct ≤ -12% → danger (within 3pts)
    //   pct ≤ -10% → warning (within 5pts)
    let severity: TapeSeverity;
    let context: string;
    if (pct <= TRIM_TRIGGER) {
      severity = "danger";
      context = "past -15% trim trigger";
    } else if (pct <= -0.12) {
      severity = "danger";
      context = "approaching -15% trim trigger";
    } else {
      severity = "warning";
      context = "approaching -15% trim trigger";
    }
    const pctStr = `${(pct * 100).toFixed(1)}%`;
    const primary = `${p.ticker} P&L ${pctStr}`;
    out.push({
      id: `portfolio:trigger:${p.ticker}`,
      severity,
      primary,
      context,
      actionLabel: "open position",
      actionHref: `/portfolio?edit=${p.ticker}`,
      _rank: {
        severity,
        asOf: p.current_price_as_of ?? "",
        magnitude: Math.abs(pct) * 100,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

function compareRanked(a: RankedTapeItem, b: RankedTapeItem): number {
  const sevDiff = SEVERITY_RANK[b._rank.severity] - SEVERITY_RANK[a._rank.severity];
  if (sevDiff !== 0) return sevDiff;
  // Recency: more recent (later ISO string) wins.
  if (a._rank.asOf !== b._rank.asOf) return a._rank.asOf < b._rank.asOf ? 1 : -1;
  // Magnitude: bigger wins.
  return b._rank.magnitude - a._rank.magnitude;
}

function stripRank(r: RankedTapeItem): TapeItem {
  // Use object rest to drop the internal _rank metadata before returning to
  // the client. Keeps the wire shape clean (and serialisable).
  const { _rank: _unused, ...rest } = r;
  void _unused;
  return rest;
}

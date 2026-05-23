"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardInsider24hRow, DashboardInsiderRow, DashboardMover } from "@/lib/dashboard-data";
import type { Tier } from "@/lib/universe-data";
import { GAUGES, type GaugeKey } from "@/lib/regime-types";
import { RailHeader, RailSection, RailEmpty, RailFooter } from "./RailChrome";

const RAIL_TIER_ORDER: readonly Tier[] = ["High", "Medium", "Low", "Avoid"] as const;

/**
 * /dashboard right rail — THS-74 rework.
 *
 *   Calendar (next 7 days)  — earnings + macro events. Schema deferred;
 *                             renders an honest empty state until the
 *                             `earnings_calendar` table lands.
 *   Insider 24h             — recent Form 4 filings (filing_date in last
 *                             24h). One row per filing — no dedupe so the
 *                             operator can see cluster density.
 *   Macro gate strip        — compact 3-gate horizontal strip with the
 *                             current macro_log multiplier underneath.
 *
 * Top Movers / MoversByTier removed per THS-74 — duplicated the main
 * canvas Score Movers table. Rail's role is awareness, not analysis.
 *
 * Width + framing unchanged: rail aside chrome owned by CtxPanel.tsx; we
 * only swap the body content.
 */
export interface DashboardTodayRailData {
  /** Carried for backward compat with the register payload; not rendered here. */
  movers: DashboardMover[];
  macroGatesHit: number;
  macroMultiplier: number;
  /** Per-gauge hit state, source: latest macro_gauges row. */
  gateState: Record<GaugeKey, boolean>;
  /** Real insider P/S transactions from last 14 days (kept for downstream consumers). */
  recentInsider: DashboardInsiderRow[];
  /** 24-hour insider window for the rail "Insider 24h" section. */
  insider24h: DashboardInsider24hRow[];
  asOf: string | null;
  synthetic: boolean;
  /**
   * Tier counts on the unified Score Movers set — carried for backward compat
   * with the rail register payload. No longer rendered in the rail (the
   * MoversByTier rail mini-chart was removed in THS-74 because it duplicated
   * the canvas Score Movers table).
   */
  moverTierCounts: Record<Tier, number>;
  activeMoverTier: Tier | null;
}

export function DashboardTodayRail({ data }: { data: DashboardTodayRailData }) {
  const { macroGatesHit, macroMultiplier, gateState, insider24h, asOf } = data;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RailHeader label="Today" right={<TodayClock />} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <RailSection title="Calendar · next 7 days">
          <CalendarPlaceholder />
        </RailSection>

        <RailSection title="Insider 24h">
          {insider24h.length === 0 ? (
            <RailEmpty>No insider activity in last 24h</RailEmpty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {insider24h.map((r, i) => (
                <Insider24hRow
                  key={`${r.ticker}-${r.transaction_date}-${r.insider_name}-${i}`}
                  r={r}
                />
              ))}
            </div>
          )}
        </RailSection>

        <RailSection title="Macro gates" divider={false}>
          <MacroGateStrip
            gatesHit={macroGatesHit}
            multiplier={macroMultiplier}
            gateState={gateState}
          />
        </RailSection>
      </div>
      <RailFooter>
        {asOf && (
          <span>
            Data as of{" "}
            <span style={{ fontFamily: "var(--m)", color: "var(--text-2)" }}>
              {formatAsOf(asOf)}
            </span>
          </span>
        )}
      </RailFooter>
    </div>
  );
}

/* ---------------- Calendar placeholder ---------------- */

/**
 * `earnings_calendar` table doesn't exist yet — the spec is explicit that
 * we render the header + an honest empty state and flag the schema gap
 * rather than build the data path before the table is migrated in.
 */
function CalendarPlaceholder() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
      <RailEmpty>No events scheduled</RailEmpty>
      <span
        style={{
          fontSize: 10,
          fontFamily: "var(--m)",
          color: "var(--text-4)",
          letterSpacing: ".04em",
          lineHeight: 1.5,
        }}
      >
        Earnings + macro releases land once the calendar feed is ingested.
      </span>
    </div>
  );
}

/* ---------------- Insider 24h row ---------------- */

function Insider24hRow({ r }: { r: DashboardInsider24hRow }) {
  const isBuy = r.transaction_code === "P";
  const sideColor = isBuy ? "var(--success)" : "var(--danger)";
  const sideLabel = isBuy ? "BUY" : "SELL";
  // Prefer transaction_value when present (operator currency); fall back to
  // shares × price approximation; finally just shares.
  const valueLabel = formatInsiderValue(r);
  return (
    <Link
      href={`/universe/${r.ticker}`}
      className="rail-row-hov"
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr",
        gap: 8,
        alignItems: "baseline",
        padding: "8px 8px",
        textDecoration: "none",
        fontFamily: "var(--m)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }}>{r.ticker}</span>
      <span style={{ fontSize: 10, color: sideColor, letterSpacing: ".04em" }}>{sideLabel}</span>
      <span style={{ fontSize: 11, color: "var(--text-3)", textAlign: "right" }}>{valueLabel}</span>
    </Link>
  );
}

function formatInsiderValue(r: DashboardInsider24hRow): string {
  if (r.transaction_value != null && Number.isFinite(r.transaction_value)) {
    return formatUsdCompact(Math.abs(r.transaction_value));
  }
  if (r.shares != null && Number.isFinite(r.shares)) {
    return `${compactNum(Math.abs(r.shares))} sh`;
  }
  return "—";
}

function formatUsdCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

/* ---------------- Macro gate strip ---------------- */

/**
 * Compact horizontal strip showing the 3 macro gates side-by-side, each as
 * a small pill colored by hit state. Above: the multiplier headline. Below:
 * an "Open regime ›" link. Source: `getLatestMacroLog()` (multiplier +
 * gates_hit) + `macro_gauges` latest row (per-gauge hit state) — both
 * threaded through `railData` by the dashboard page.
 */
function MacroGateStrip({
  gatesHit,
  multiplier,
  gateState,
}: {
  gatesHit: number;
  multiplier: number;
  gateState: Record<GaugeKey, boolean>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 2 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 22,
            fontWeight: 600,
            color: gatesHit > 0 ? "var(--warning)" : "var(--text-1)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {gatesHit}
          <span style={{ color: "var(--text-3)", fontSize: 13, fontWeight: 500 }}>/3</span>
        </span>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 11,
            color: "var(--text-3)",
            marginLeft: 4,
          }}
        >
          gates hit · {multiplier.toFixed(2)}×
        </span>
      </div>

      {/* Horizontal 3-pill strip — one cell per gate, hit cells filled in
          --warning, miss cells in --border-subtle. Cells share equal flex
          so the strip stretches to fill the rail's content width. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GAUGES.length}, minmax(0, 1fr))`,
          gap: 4,
        }}
        role="group"
        aria-label="Macro gates"
      >
        {GAUGES.map((g) => {
          const hit = gateState[g.key as GaugeKey] === true;
          return (
            <Link
              key={g.key}
              href="/regime"
              title={`${g.label} — ${hit ? "gate hit" : "below threshold"}`}
              aria-label={`${g.label} ${hit ? "hit" : "not hit"}`}
              style={{
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "6px 8px",
                borderRadius: 3,
                border: `1px solid ${hit ? "var(--warning)" : "var(--border-subtle)"}`,
                background: hit ? "var(--warning-soft, transparent)" : "transparent",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: hit ? "var(--warning)" : "var(--text-4)",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--m)",
                  color: hit ? "var(--text-1)" : "var(--text-3)",
                  letterSpacing: ".02em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {shortGaugeLabel(g.key)}
              </span>
            </Link>
          );
        })}
      </div>

      <Link href="/regime" className="accent-link" style={{ fontSize: 11, marginTop: 2 }}>
        Open regime <span className="accent-link-chev">›</span>
      </Link>
    </div>
  );
}

function shortGaugeLabel(key: GaugeKey): string {
  switch (key) {
    case "naaim":
      return "NAAIM";
    case "aaii_3wk_spread":
      return "AAII";
    case "fear_greed":
      return "F&G";
  }
}

/* ---------------- TodayClock + asOf + formatters ---------------- */

/**
 * Live wall-clock chip in the header right slot. Re-derives every 60s.
 * Format: "Mon May 18 · 9:34 AM CT".
 */
function TodayClock() {
  const [label, setLabel] = useState(() => formatNow());
  useEffect(() => {
    setLabel(formatNow());
    const id = setInterval(() => setLabel(formatNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      style={{
        fontSize: 10.5,
        fontFamily: "var(--m)",
        color: "var(--text-2)",
        letterSpacing: ".02em",
        textTransform: "none",
        fontWeight: 400,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function formatNow(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayPart = `${get("weekday")} ${get("month")} ${get("day")}`;
  const timePart = `${get("hour")}:${get("minute")} ${get("dayPeriod")} CT`;
  return `${dayPart} · ${timePart}`;
}

/**
 * Long-form date for the footer "Data as of" line. Score snapshots are
 * date-keyed (no clock time), so we render "May 9, 2026" — no fabricated
 * "4:00 PM CT" timestamp.
 */
function formatAsOf(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = months[parseInt(m[2], 10) - 1] ?? m[2];
  const day = parseInt(m[3], 10);
  return `${monthName} ${day}, ${m[1]}`;
}

function compactNum(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// RAIL_TIER_ORDER intentionally retained as an exported const (Tier consumers
// elsewhere import the same ordering). MoversByTier was removed in THS-74.
export { RAIL_TIER_ORDER };

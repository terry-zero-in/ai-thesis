"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DashboardInsiderRow, DashboardMover } from "@/lib/dashboard-data";
import type { Tier } from "@/lib/universe-data";
import { GAUGES, type GaugeKey } from "@/lib/regime-types";
import { RailHeader, RailSection, RailEmpty, RailFooter } from "./RailChrome";

/** Tier → token map — canonical semantic traffic-light (v1.2 2026-05-19,
 *  matches TierBadge / PositionsTable / TopPositionsList / UniverseInsightsRail). */
const TIER_COLORS: Record<Tier, string> = {
  High: "var(--success)",
  Medium: "var(--text-1)",
  Low: "var(--warning)",
  Avoid: "var(--danger)",
};
const RAIL_TIER_ORDER: Tier[] = ["High", "Medium", "Low", "Avoid"];

/**
 * /dashboard right rail — /lambo Dashboard polish D6/G6 differentiation:
 *
 *   "The right rail currently duplicates the main 'Score Movers' table.
 *    Differentiate it by purpose: the main canvas is for analysis, the
 *    rail is for awareness."
 *
 * Sections (top → bottom):
 *   1. Today header + live wall-clock date line
 *   2. Calendar · upcoming   (earnings + macro release feed — v1.1 placeholder)
 *   3. Insider · recent      (Form 4 last 14 days)
 *   4. Macro gates summary   (per-gauge hit/miss + multiplier)
 *
 * Removed Top Movers section per /lambo critique — it duplicated the main
 * canvas table. Rail data still carries `movers` so consumers can opt back
 * in later if positioning warrants it.
 */
export interface DashboardTodayRailData {
  movers: DashboardMover[];
  macroGatesHit: number;
  macroMultiplier: number;
  /** Per-gauge hit state, source: any scored UniverseRow.macro_gates_active. */
  gateState: Record<GaugeKey, boolean>;
  /** Real insider P/S transactions from last 14 days (top 5 by date desc). */
  recentInsider: DashboardInsiderRow[];
  asOf: string | null;
  synthetic: boolean;
  /**
   * Tier counts on the unified Score Movers set (always full set — not
   * filtered). Bars in the rail represent these. Per task #77 + S9 lock:
   * aggregates run on ALL rows; filter only affects the table.
   */
  moverTierCounts: Record<Tier, number>;
  /** Currently active mover-tier filter, or null. Driven by ?moverTier=X URL. */
  activeMoverTier: Tier | null;
}

export function DashboardTodayRail({ data }: { data: DashboardTodayRailData }) {
  const { macroGatesHit, macroMultiplier, gateState, recentInsider, asOf, moverTierCounts, activeMoverTier } = data;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RailHeader label="Today" right={<TodayClock />} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/*
          Mini-Insights port (task #77, S10). Compressed version of the
          Universe Insights rail bar chart, scoped to the Score Movers set.
          Click a bar = filter Score Movers table to that tier via
          ?moverTier=X URL state. Aggregates run on the full unfiltered
          set so bar heights stay stable.
        */}
        <RailSection title="Movers by tier">
          <MoversByTier counts={moverTierCounts} activeTier={activeMoverTier} />
        </RailSection>

        {/*
          Calendar placeholder removed S8 — per Linear "calmer" principles
          Terry shared (don't compete for attention you haven't earned;
          placeholder reads incomplete, absence reads scoped). Earnings
          and macro-release calendar land in v1.1 and graduate this slot
          when there's real data to render.
        */}
        <RailSection title="Insider · recent">
          {recentInsider.length === 0 ? (
            <RailEmpty>No qualifying insider activity in the last 14 days.</RailEmpty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentInsider.map((r, i) => (
                <InsiderRow
                  key={`${r.ticker}-${r.transaction_date}-${i}`}
                  r={r}
                  isLast={i === recentInsider.length - 1}
                />
              ))}
            </div>
          )}
        </RailSection>

        <RailSection title="Macro gates" divider={false}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              paddingBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: "var(--m)",
                fontSize: 22,
                fontWeight: 600,
                color: macroGatesHit > 0 ? "var(--warning)" : "var(--text-1)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {macroGatesHit}
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
              gates hit · {macroMultiplier.toFixed(2)}×
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
            {GAUGES.map((g) => (
              <GateRow key={g.key} label={g.label} hit={gateState[g.key as GaugeKey] === true} />
            ))}
          </div>
          <Link
            href="/regime"
            style={{
              fontSize: 11,
              color: "var(--accent)",
              textDecoration: "none",
              fontFamily: "var(--m)",
              marginTop: 8,
            }}
          >
            Open regime ›
          </Link>
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

/**
 * Live wall-clock chip in the header right slot. Re-derives every 60s.
 * Format: "Mon May 18 · 9:34 AM CT" — abbreviated weekday + month + 12h
 * time + Chicago-time TZ marker.
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
 * Compact insider row: TICKER · P/S badge · shares · "5d ago".
 * Whole row stretched-link → /universe/[ticker] so a single click jumps to
 * the name detail where the full Form 4 surface lives.
 */
function InsiderRow({ r, isLast }: { r: DashboardInsiderRow; isLast: boolean }) {
  const isBuy = r.transaction_code === "P";
  const sideColor = isBuy ? "var(--success)" : "var(--danger)";
  const sideLabel = isBuy ? "BUY" : "SELL";
  const daysAgo = relDays(r.transaction_date);
  const sharesFmt = r.shares != null ? compactNum(r.shares) : "—";
  // Per-ticker dedupe pass in getRecentInsider collapses N same-side
  // filings into one row. Show "(N)" only when N > 1 so single filings
  // stay quiet.
  const filingsBadge = r.filing_count > 1 ? `(${r.filing_count})` : null;
  return (
    <Link
      href={`/universe/${r.ticker}`}
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr auto",
        gap: 8,
        alignItems: "baseline",
        padding: "8px 0",
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        textDecoration: "none",
        fontFamily: "var(--m)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }}>{r.ticker}</span>
      <span style={{ fontSize: 10, color: sideColor, letterSpacing: ".04em" }}>{sideLabel}</span>
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>
        {sharesFmt} sh
        {filingsBadge && (
          <span style={{ color: "var(--text-4)", marginLeft: 6 }}>{filingsBadge}</span>
        )}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-3)", whiteSpace: "nowrap" }}>{daysAgo}</span>
    </Link>
  );
}

/**
 * Long-form date for the footer "Data as of" line. Score snapshots are
 * date-keyed (no clock time), so we render "May 9, 2026" — no fabricated
 * "4:00 PM CT" timestamp. Honesty over polish per [[feedback_no_fabricated_quotes]].
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

function relDays(iso: string): string {
  const d = new Date(iso + "T00:00:00Z").getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  const days = Math.round((today - d) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

/**
 * MoversByTier — rail-compressed version of the Universe Insights bar
 * chart. 4 bars (one per tier), heights proportional to count within the
 * unified Score Movers set (8 rows). Click a bar → toggle ?moverTier=X
 * URL filter. Non-active bars dim opacity when any filter is engaged.
 */
function MoversByTier({
  counts,
  activeTier,
}: {
  counts: Record<Tier, number>;
  activeTier: Tier | null;
}) {
  const router = useRouter();
  const maxCount = Math.max(1, ...RAIL_TIER_ORDER.map((t) => counts[t]));
  const totalCount = RAIL_TIER_ORDER.reduce((s, t) => s + counts[t], 0);

  function toggle(t: Tier) {
    if (activeTier === t) router.push("/");
    else router.push(`/?moverTier=${t}`);
  }

  if (totalCount === 0) {
    return <RailEmpty>No score movement this week.</RailEmpty>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
      {/* Bar chart row — 4 bars side by side, 56px tall, flex weights equal */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          height: 56,
          paddingBottom: 1,
        }}
      >
        {RAIL_TIER_ORDER.map((t) => {
          const count = counts[t];
          const heightPct = count === 0 ? 4 : Math.max(8, (count / maxCount) * 100);
          const isActive = activeTier === t;
          const dim = activeTier != null && !isActive;
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              aria-label={`Filter Score Movers to ${t} tier (${count} ${count === 1 ? "name" : "names"})`}
              style={{
                flex: 1,
                height: `${heightPct}%`,
                background: TIER_COLORS[t],
                opacity: dim ? 0.3 : 1,
                filter: dim ? "saturate(0.4)" : undefined,
                border: "none",
                borderRadius: 2,
                cursor: count === 0 ? "default" : "pointer",
                padding: 0,
                transition:
                  "opacity var(--dur-instant) var(--ease-out), filter var(--dur-instant) var(--ease-out)",
              }}
            />
          );
        })}
      </div>
      {/* Legend table — color dot · tier · count, click to toggle */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {RAIL_TIER_ORDER.map((t) => {
          const count = counts[t];
          const isActive = activeTier === t;
          const dim = activeTier != null && !isActive;
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              disabled={count === 0}
              style={{
                display: "grid",
                gridTemplateColumns: "10px 1fr auto",
                gap: 8,
                alignItems: "center",
                background: isActive ? "var(--elevated)" : "transparent",
                border: "none",
                padding: "3px 6px",
                borderRadius: 3,
                cursor: count === 0 ? "default" : "pointer",
                opacity: dim || count === 0 ? 0.4 : 1,
                fontSize: 11.5,
                fontFamily: "var(--m)",
                color: "var(--text-2)",
                textAlign: "left",
                transition: "opacity var(--dur-instant) var(--ease-out)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: TIER_COLORS[t],
                }}
              />
              <span>{t}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-3)" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {activeTier && (
        <button
          onClick={() => router.push("/")}
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--accent)",
            background: "none",
            border: "none",
            padding: "4px 0 0",
            cursor: "pointer",
            textAlign: "left",
            letterSpacing: ".02em",
          }}
        >
          Clear filter ✕
        </button>
      )}
    </div>
  );
}

function GateRow({ label, hit }: { label: string; hit: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11.5,
        fontFamily: "var(--m)",
        color: hit ? "var(--text-1)" : "var(--text-3)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: hit ? "var(--warning)" : "var(--text-4)",
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: ".04em", textTransform: "uppercase" }}>
        {hit ? "hit" : "—"}
      </span>
    </div>
  );
}

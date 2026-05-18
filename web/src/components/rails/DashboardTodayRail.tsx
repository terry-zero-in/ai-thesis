"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardInsiderRow, DashboardMover } from "@/lib/dashboard-data";
import { GAUGES, type GaugeKey } from "@/lib/regime-types";
import { RailHeader, RailSection, RailEmpty, RailFooter } from "./RailChrome";

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
}

export function DashboardTodayRail({ data }: { data: DashboardTodayRailData }) {
  const { macroGatesHit, macroMultiplier, gateState, recentInsider, asOf } = data;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RailHeader label="Today" right={<TodayClock />} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <RailSection title="Calendar · upcoming">
          <RailEmpty>
            Earnings dates + Fed / macro releases for your universe land in v1.1.
            For now, name-level events appear on each ticker detail page.
          </RailEmpty>
        </RailSection>

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
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{sharesFmt} sh</span>
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

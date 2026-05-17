"use client";

import { RailHeader, RailSection, RailEmpty, RailFooter } from "./RailChrome";

/**
 * /aiq/[ticker] right rail — Master Design Spec §6:
 *   "Prior-version history with deltas"
 *
 * Mirrors the on-canvas <AiqHistory/> aside but compressed for the rail:
 * one row per prior version, showing scored_at + total + Δ vs the next-
 * older row. Latest (top) is the live row referenced on the canvas; the
 * rail's value is the historical chain at a glance.
 */
export interface AiqHistoryRailRow {
  scored_at: string;
  total: number;
  delta: number | null; // vs the row immediately older; null on oldest row
  notes: string | null;
}

export interface AiqHistoryRailData {
  ticker: string;
  rows: AiqHistoryRailRow[];
  envConfigured: boolean;
}

export function AiqHistoryRail({ data }: { data: AiqHistoryRailData }) {
  const { ticker, rows, envConfigured } = data;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RailHeader
        label={`${ticker} · Rubric history`}
        right={
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--m)",
              color: "var(--text-3)",
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            {rows.length} {rows.length === 1 ? "version" : "versions"}
          </span>
        }
      />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <RailSection title="Versions" divider={false}>
          {rows.length === 0 ? (
            <RailEmpty>
              {envConfigured
                ? "No saved rubric versions yet."
                : "DB unconfigured — save a draft from the editor to populate history."}
            </RailEmpty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {rows.map((r, i) => (
                <HistoryRow key={`${r.scored_at}-${i}`} r={r} isLatest={i === 0} isLast={i === rows.length - 1} />
              ))}
            </div>
          )}
        </RailSection>
      </div>
      <RailFooter>
        <span>
          Editor saves create new versioned rows (UPSERT on same day).
        </span>
      </RailFooter>
    </div>
  );
}

function HistoryRow({
  r,
  isLatest,
  isLast,
}: {
  r: AiqHistoryRailRow;
  isLatest: boolean;
  isLast: boolean;
}) {
  const dirColor =
    r.delta == null
      ? "var(--text-3)"
      : r.delta > 0
        ? "var(--success)"
        : r.delta < 0
          ? "var(--danger)"
          : "var(--text-3)";
  const deltaStr =
    r.delta == null ? "—" : `${r.delta > 0 ? "+" : ""}${r.delta}`;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        gap: 10,
        alignItems: "baseline",
        padding: "10px 0",
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        fontFamily: "var(--m)",
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          color: "var(--text-3)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: ".02em",
        }}
      >
        {r.scored_at.slice(2).replace(/-/g, "·")}
      </span>
      <span
        style={{
          fontSize: 10,
          color: isLatest ? "var(--accent)" : "var(--text-4)",
          fontWeight: isLatest ? 600 : 500,
          letterSpacing: ".06em",
          textTransform: "uppercase",
        }}
      >
        {isLatest ? "latest" : ""}
      </span>
      <span
        style={{
          fontSize: 13,
          color: isLatest ? "var(--text-1)" : "var(--text-2)",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {r.total}
      </span>
      <span
        style={{
          fontSize: 11.5,
          color: dirColor,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {deltaStr}
      </span>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { DashboardMover, DashboardSnapshot } from "@/lib/dashboard-data";
import { GAUGES, type GaugeKey } from "@/lib/regime-types";
import { RailHeader, RailSection, RailEmpty, RailGhost, RailFooter } from "./RailChrome";

/**
 * /dashboard right rail — Master Design Spec §6:
 *   "Top score movers (5), insider today, macro gates summary"
 *
 * Three sub-sections, compressed for the 320px rail. Differs from the main
 * canvas Score Movers table (top 8 unified) — rail shows top 5 by abs(Δ),
 * each as a clickable mono row that deep-links into /universe/[ticker].
 *
 * Insider Today is a deferred-feature ghost per the established pattern on
 * /universe/[ticker] — Form 4 ingestion ships under THS-66.
 *
 * Macro Gates summary mirrors the main canvas "N of 3 gates hit · 0.95×"
 * line but expanded to list each gate by name with its hit/miss state, so
 * the rail answers "which gates" without making the user pan back to the
 * GaugeRow at the bottom of the canvas.
 */
export interface DashboardTodayRailData {
  movers: DashboardMover[];
  macroGatesHit: number;
  macroMultiplier: number;
  /** Per-gauge hit state, source: any scored UniverseRow.macro_gates_active. */
  gateState: Record<GaugeKey, boolean>;
  asOf: string | null;
  synthetic: boolean;
}

export function DashboardTodayRail({ data }: { data: DashboardTodayRailData }) {
  const { movers, macroGatesHit, macroMultiplier, gateState, asOf, synthetic } = data;
  const top5 = movers.slice(0, 5);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RailHeader label="Today" />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <RailSection title="Top movers · 7D">
          {top5.length === 0 ? (
            <RailEmpty>No composite movement this week.</RailEmpty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {top5.map((m, i) => (
                <MoverRow key={m.ticker} m={m} isLast={i === top5.length - 1} />
              ))}
            </div>
          )}
        </RailSection>

        <RailSection title="Insider · today">
          <RailGhost ticket="THS-66" label="Form 4 ingestion lands here once shipped." />
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
            As of <span style={{ fontFamily: "var(--m)", color: "var(--text-2)" }}>{asOf}</span>
            {synthetic ? " (fixture)" : ""}
          </span>
        )}
      </RailFooter>
    </div>
  );
}

function MoverRow({ m, isLast }: { m: DashboardMover; isLast: boolean }) {
  const dir = m.delta > 0 ? "↑" : m.delta < 0 ? "↓" : "→";
  const dirColor = m.delta > 0 ? "var(--success)" : m.delta < 0 ? "var(--danger)" : "var(--text-3)";
  return (
    <Link
      href={`/universe/${m.ticker}`}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 8,
        alignItems: "baseline",
        padding: "8px 0",
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        textDecoration: "none",
        fontFamily: "var(--m)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }}>{m.ticker}</span>
      <span style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".04em" }}>
        {m.layer_label.replace(/^L\d\s+/, "")}
      </span>
      <span style={{ fontSize: 12, color: dirColor, whiteSpace: "nowrap" }}>
        {dir} {m.delta > 0 ? "+" : ""}
        {m.delta.toFixed(1)}
      </span>
    </Link>
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

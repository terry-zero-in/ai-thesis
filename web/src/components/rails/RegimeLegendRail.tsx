"use client";

import { fmtGaugeValue, type GaugeKey } from "@/lib/regime-types";
import { RailHeader, RailSection, RailFooter } from "./RailChrome";

/**
 * /regime right rail — Master Design Spec §6:
 *   "Threshold legend for NAAIM/AAII/F&G"
 *
 * Each gauge gets a row: label, current reading vs threshold, hit/clear
 * dot. Below the rows: the gate-count → multiplier table (0→1.00,
 * 1→0.95, 2→0.90, 3→0.85) so an operator reading the rail can answer
 * "what multiplier applies at N gates" without leaving the page.
 */
export interface RegimeLegendItem {
  key: GaugeKey;
  label: string;
  value: number | null;
  threshold: number;
  hit: boolean;
  blurb: string;
}

export interface RegimeLegendRailData {
  items: RegimeLegendItem[];
  gatesHit: number;
  multiplier: number;
  asOf: string | null;
  synthetic: boolean;
}

const MULT_TABLE: ReadonlyArray<{ gates: number; mult: number }> = [
  { gates: 0, mult: 1.0 },
  { gates: 1, mult: 0.95 },
  { gates: 2, mult: 0.9 },
  { gates: 3, mult: 0.85 },
];

export function RegimeLegendRail({ data }: { data: RegimeLegendRailData }) {
  const { items, gatesHit, multiplier, asOf, synthetic } = data;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RailHeader label="Threshold legend" />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <RailSection title="Gates">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((it) => (
              <LegendRow key={it.label} it={it} />
            ))}
          </div>
        </RailSection>

        <RailSection title="Multiplier table" divider={false}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {MULT_TABLE.map((row, i) => {
              const active = row.gates === gatesHit;
              return (
                <div
                  key={row.gates}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 12,
                    alignItems: "baseline",
                    padding: "8px 0",
                    borderBottom: i === MULT_TABLE.length - 1 ? undefined : "1px solid var(--border-subtle)",
                    fontFamily: "var(--m)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: active ? "var(--accent)" : "var(--text-3)",
                      fontWeight: active ? 600 : 500,
                      letterSpacing: ".04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {row.gates} {row.gates === 1 ? "gate" : "gates"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {row.gates === 0 ? "neutral" : `de-rate ≥75 by ${((1 - row.mult) * 100).toFixed(0)}%`}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: active ? "var(--accent)" : "var(--text-2)",
                      fontWeight: active ? 600 : 500,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {row.mult.toFixed(2)}×
                  </span>
                </div>
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
            Currently <span style={{ fontFamily: "var(--m)", color: "var(--text-2)" }}>{gatesHit}</span>{" "}
            {gatesHit === 1 ? "gate" : "gates"} hit · multiplier{" "}
            <span style={{ fontFamily: "var(--m)", color: "var(--text-2)" }}>{multiplier.toFixed(2)}×</span>{" "}
            active on High tier.
          </span>
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

function LegendRow({ it }: { it: RegimeLegendItem }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: it.hit ? "var(--warning)" : "rgba(255,255,255,.15)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            color: it.hit ? "var(--text-1)" : "var(--text-2)",
            fontFamily: "var(--m)",
            flex: 1,
            minWidth: 0,
          }}
        >
          {it.label}
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontFamily: "var(--m)",
            color: it.hit ? "var(--warning)" : "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {it.value == null ? "—" : fmtGaugeValue(it.value, it.key)}
          <span style={{ color: "var(--text-4)" }}> / {fmtGaugeValue(it.threshold, it.key)}</span>
        </span>
      </div>
      <span style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.45, paddingLeft: 14 }}>
        {it.blurb}
      </span>
    </div>
  );
}

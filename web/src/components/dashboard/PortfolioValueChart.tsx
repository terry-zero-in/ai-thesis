"use client";

import { useMemo, useState } from "react";
import { LineChart } from "@/components/primitives/LineChart";

/**
 * PortfolioValueChart — canvas card showing portfolio book value over time
 * with range pills (1D / 5D / 1M / 6M / YTD / 1Y / All). Wrapped in a
 * var(--surface) card per Instrument-Field §3.1 Inset role.
 *
 * v1 data: synthesized random walk anchored at currentValue, deterministic
 * by ticker-count seed so the chart is stable across page loads. Live data
 * (positions_history table) is THS-XX (deferred until daily snapshotter).
 *
 * Header shows: title, current value, change-since-range-start with %.
 */
type RangeKey = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "All";

const RANGES: { key: RangeKey; days: number; label: string }[] = [
  { key: "1D", days: 1, label: "1D" },
  { key: "5D", days: 5, label: "5D" },
  { key: "1M", days: 30, label: "1M" },
  { key: "6M", days: 180, label: "6M" },
  { key: "YTD", days: 138, label: "YTD" }, // approximation for fixture
  { key: "1Y", days: 365, label: "1Y" },
  { key: "All", days: 730, label: "All" },
];

export function PortfolioValueChart({
  currentValue,
  empty,
  synthetic,
}: {
  currentValue: number;
  empty: boolean;
  synthetic: boolean;
}) {
  const [range, setRange] = useState<RangeKey>("1M");
  const days = RANGES.find((r) => r.key === range)?.days ?? 30;

  const data = useMemo(() => synthesize(currentValue, days, empty), [currentValue, days, empty]);
  const startValue = data[0];
  const change = currentValue - startValue;
  const changePct = startValue > 0 ? (change / startValue) * 100 : 0;
  const positive = change >= 0;
  const changeColor = positive ? "var(--success)" : "var(--danger)";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        padding: "16px 20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              color: "var(--text-3)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            Portfolio value
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--m)",
                fontSize: 22,
                fontWeight: 600,
                color: "var(--text-1)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {empty ? "—" : fmtUsd(currentValue)}
            </span>
            {!empty && (
              <span
                style={{
                  fontFamily: "var(--m)",
                  fontSize: 12,
                  color: changeColor,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {positive ? "+" : ""}
                {fmtUsd(change, true)} · {positive ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <RangePicker value={range} onChange={setRange} />
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 180, position: "relative" }}>
        {empty ? (
          <ChartEmpty />
        ) : (
          <ChartSvg data={data} color={positive ? "var(--success)" : "var(--danger)"} />
        )}
      </div>

      {/* Footer */}
      {!empty && synthetic && (
        <div
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-4)",
            letterSpacing: ".04em",
          }}
        >
          Fixture · deterministic random walk anchored at current value · live
          data lands when positions_history snapshot wires up
        </div>
      )}
    </div>
  );
}

function RangePicker({ value, onChange }: { value: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: "var(--canvas)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 4,
        padding: 2,
      }}
    >
      {RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            onClick={() => onChange(r.key)}
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              fontWeight: active ? 600 : 400,
              color: active ? "var(--text-1)" : "var(--text-3)",
              background: active ? "var(--elevated)" : "transparent",
              border: "none",
              padding: "3px 8px",
              borderRadius: 3,
              cursor: "pointer",
              letterSpacing: ".02em",
              transition: "background var(--dur-instant) var(--ease-out)",
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function ChartSvg({ data, color }: { data: number[]; color: string }) {
  // Render at fixed 1200×180 viewBox and let SVG scale to container.
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <LineChart data={data} width={1200} height={180} color={color} strokeWidth={1.5} filled />
    </div>
  );
}

function ChartEmpty() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-4)",
        fontSize: 12,
        fontFamily: "var(--m)",
      }}
    >
      No positions yet — chart renders once your book has history.
    </div>
  );
}

function fmtUsd(n: number, signed = false): string {
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${sign}$${body}`;
}

/**
 * Deterministic random walk anchored at `currentValue` over `days` points.
 * Uses a fixed seed (currentValue itself as integer) so the chart stays
 * stable across React re-renders. Last point ALWAYS = currentValue so the
 * displayed "now" matches the KPI tile.
 */
function synthesize(currentValue: number, days: number, empty: boolean): number[] {
  if (empty || currentValue <= 0) {
    // Empty-state: flat line at 0 for visual continuity
    return Array(Math.max(2, days)).fill(0);
  }
  const points = Math.max(2, Math.min(days, 365));
  const seed = Math.floor(currentValue);
  // Backwards from current. Step volatility scales with value (% basis).
  const result: number[] = [];
  let v = currentValue;
  let s = seed;
  for (let i = 0; i < points; i++) {
    result.unshift(v);
    // LCG-ish prng (cheap, deterministic).
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const noise = (s / 0x7fffffff - 0.5) * 0.012; // ±0.6% per day
    // Add slight upward drift over time so longer ranges look more dynamic
    const drift = -0.0008;
    v = v / (1 + noise + drift);
    if (v < currentValue * 0.5) v = currentValue * 0.5;
  }
  return result;
}

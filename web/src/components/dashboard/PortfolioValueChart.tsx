"use client";

import { useMemo, useRef, useState } from "react";
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
 * Hover: crosshair + value+date tooltip per Linear/Mercury pattern. Tooltip
 * resolves to the nearest data point — for daily-step fixtures that means
 * single-day precision.
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

const CHART_H = 180;
const CHART_VIEW_W = 1200;
const PADDING_Y = 2;

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

  const series = useMemo(() => synthesize(currentValue, days, empty), [currentValue, days, empty]);
  const data = series.values;
  const dates = series.dates;
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
      <div style={{ width: "100%", height: CHART_H, position: "relative" }}>
        {empty ? (
          <ChartEmpty />
        ) : (
          // Line color is brand-neutral (--accent). Trend communication lives
          // in the +/- $ · +/- % chip beside the headline value — color-coding
          // the whole line decorates with severity (/lambo: "Severity colors
          // only at severity moments. The accent is even more precious.").
          <ChartWithHover data={data} dates={dates} />
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

/**
 * Chart with crosshair + tooltip on hover. The base LineChart renders the
 * filled area + line; this wrapper overlays a transparent capture rect to
 * track mouse position, then renders crosshair + dot + tooltip when active.
 *
 * Hit-testing: nearest data-index by x-position. For ranges with hundreds
 * of points this rounds to the visually-nearest day, which is what users
 * actually want — no interpolation, no fuzz.
 */
function ChartWithHover({ data, dates }: { data: number[]; dates: Date[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number; clientX: number } | null>(null);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const usableH = CHART_H - PADDING_Y * 2;
  const step = data.length <= 1 ? 0 : CHART_VIEW_W / (data.length - 1);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (e.clientX - rect.left) / rect.width;
    const rawIdx = Math.round(relX * (data.length - 1));
    const idx = Math.max(0, Math.min(data.length - 1, rawIdx));
    setHover({ idx, clientX: e.clientX - rect.left });
  }

  const hoverX = hover ? (hover.idx * step) : 0;
  const hoverY = hover
    ? PADDING_Y + (1 - (data[hover.idx] - min) / range) * usableH
    : 0;

  // Convert hoverX from viewBox coordinates → container percent so the dot
  // + crosshair land at the right visual position regardless of container
  // width. The SVG uses preserveAspectRatio="none" so X-scaling is linear.
  const hoverXPct = data.length <= 1 ? 0 : (hover ? hover.idx / (data.length - 1) : 0) * 100;
  const hoverYPct = (hoverY / CHART_H) * 100;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
      style={{ width: "100%", height: "100%", position: "relative", cursor: "crosshair" }}
    >
      <LineChart data={data} width={CHART_VIEW_W} height={CHART_H} color="var(--accent)" strokeWidth={1.5} filled />
      {hover && (
        <>
          {/* Crosshair vertical guideline */}
          <div
            style={{
              position: "absolute",
              left: `${hoverXPct}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: "var(--text-3)",
              opacity: 0.4,
              pointerEvents: "none",
            }}
          />
          {/* Point marker */}
          <div
            style={{
              position: "absolute",
              left: `${hoverXPct}%`,
              top: `${hoverYPct}%`,
              width: 8,
              height: 8,
              marginLeft: -4,
              marginTop: -4,
              borderRadius: "50%",
              background: "var(--accent)",
              border: "2px solid var(--surface)",
              pointerEvents: "none",
            }}
          />
          {/* Tooltip card */}
          <HoverTooltip
            value={data[hover.idx]}
            date={dates[hover.idx]}
            containerXPct={hoverXPct}
          />
        </>
      )}
    </div>
  );
}

function HoverTooltip({
  value,
  date,
  containerXPct,
}: {
  value: number;
  date: Date;
  containerXPct: number;
}) {
  // Clamp horizontal anchor so tooltip doesn't overflow the chart edges.
  // Tooltip is roughly 130px wide; chart container width varies by viewport.
  // Using CSS-only clamping via translateX with edge-aware offset.
  const leftEdge = containerXPct < 10;
  const rightEdge = containerXPct > 90;
  const transform = leftEdge
    ? "translateX(0)"
    : rightEdge
      ? "translateX(-100%)"
      : "translateX(-50%)";
  return (
    <div
      style={{
        position: "absolute",
        left: `${containerXPct}%`,
        top: 4,
        transform,
        background: "var(--elevated)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "6px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        boxShadow: "0 2px 8px rgba(0,0,0,.4)",
        zIndex: 2,
      }}
    >
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-1)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
        }}
      >
        {fmtUsd(value)}
      </span>
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 10,
          color: "var(--text-3)",
          letterSpacing: ".02em",
          lineHeight: 1.2,
        }}
      >
        {formatDate(date)}
      </span>
    </div>
  );
}

function formatDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
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
 *
 * NO drift — drift bias compounds catastrophically when walking backward
 * (a -0.08%/day drift over 365 iterations produced ~-29% phantom losses
 * across the 1Y range, making the demo portfolio look like it tanked).
 * Pure noise centered at zero keeps the walk anchored at currentValue.
 *
 * Returns parallel arrays: values + dates (one Date per data point,
 * stepping back one calendar day per index from today).
 */
function synthesize(
  currentValue: number,
  days: number,
  empty: boolean,
): { values: number[]; dates: Date[] } {
  const points = Math.max(2, Math.min(days, 730));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 0; i < points; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (points - 1 - i));
    dates.push(d);
  }

  if (empty || currentValue <= 0) {
    return { values: Array(points).fill(0), dates };
  }

  const seed = Math.floor(currentValue);
  const values: number[] = [];
  let v = currentValue;
  let s = seed;
  for (let i = 0; i < points; i++) {
    values.unshift(v);
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const noise = (s / 0x7fffffff - 0.5) * 0.012; // ±0.6% per day
    v = v / (1 + noise);
    if (v < currentValue * 0.5) v = currentValue * 0.5;
    if (v > currentValue * 2) v = currentValue * 2;
  }
  return { values, dates };
}

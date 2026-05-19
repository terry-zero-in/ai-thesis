"use client";

import { useRef, useState } from "react";
import { LineChart } from "@/components/primitives/LineChart";
import type { NameSparkPoint } from "@/lib/name-detail-data";

/**
 * NameScoreChart — composite score over time for a single name. Per Terry
 * S9 (task #78): "we've got to have some sort of line chart for each so we
 * can see the trend up or down etx over time."
 *
 * Score history is weekly (Saturday chain), so the chart is sparse — 12-20
 * points typical. Hover shows the composite at that week + the score date.
 *
 * Wrapped in a card per Instrument-Field §3.1 Inset role (the name-detail
 * page has multiple competing surfaces, so card containment helps separate
 * the chart from the factor breakdown grid below it).
 */
const CHART_VIEW_W = 1200;
const CHART_H = 140;
const PADDING_Y = 6;

export function NameScoreChart({ history, ticker }: { history: NameSparkPoint[]; ticker: string }) {
  // Filter out null composites — keep parallel date alignment.
  const points = history.filter((h) => h.composite != null) as Array<{ as_of: string; composite: number }>;
  if (points.length < 2) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          padding: "16px 20px",
          color: "var(--text-3)",
          fontSize: 12,
          fontFamily: "var(--m)",
        }}
      >
        Score history insufficient — {ticker} needs ≥2 scored weeks before the chart renders.
      </div>
    );
  }

  const values = points.map((p) => p.composite);
  const dates = points.map((p) => p.as_of);
  const first = values[0];
  const last = values[values.length - 1];
  const change = Number((last - first).toFixed(1));
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Composite score · {points.length}-week history
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 12,
            color: "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {first.toFixed(1)} → {last.toFixed(1)}
        </span>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 12,
            fontWeight: 600,
            color: changeColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {positive ? "+" : ""}
          {change.toFixed(1)}
        </span>
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: CHART_H, position: "relative" }}>
        <ChartWithHover values={values} dates={dates} />
      </div>
    </div>
  );
}

/**
 * Crosshair + tooltip wrapper. Mirrors the pattern in PortfolioValueChart
 * but with score-shaped formatting (XX.X instead of $X,XXX).
 */
function ChartWithHover({ values, dates }: { values: number[]; dates: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number } | null>(null);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usableH = CHART_H - PADDING_Y * 2;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (e.clientX - rect.left) / rect.width;
    const rawIdx = Math.round(relX * (values.length - 1));
    const idx = Math.max(0, Math.min(values.length - 1, rawIdx));
    setHover({ idx });
  }

  const hoverXPct = values.length <= 1 ? 0 : (hover ? hover.idx / (values.length - 1) : 0) * 100;
  const hoverY = hover
    ? PADDING_Y + (1 - (values[hover.idx] - min) / range) * usableH
    : 0;
  const hoverYPct = (hoverY / CHART_H) * 100;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
      style={{ width: "100%", height: "100%", position: "relative", cursor: "crosshair" }}
    >
      <LineChart
        data={values}
        width={CHART_VIEW_W}
        height={CHART_H}
        color="var(--accent)"
        strokeWidth={1.5}
        filled
        paddingY={PADDING_Y}
      />
      {hover && (
        <>
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
          <HoverTooltip value={values[hover.idx]} date={dates[hover.idx]} containerXPct={hoverXPct} />
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
  date: string;
  containerXPct: number;
}) {
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
        {value.toFixed(1)}
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
        {date}
      </span>
    </div>
  );
}

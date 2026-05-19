"use client";

import { useRef, useState } from "react";
import { LineChart } from "@/components/primitives/LineChart";
import type { NameSparkPoint } from "@/lib/name-detail-data";

/**
 * NameScoreChart — dual-line composite + price chart for a single name
 * (task #78). Two independently-scaled series in the same coordinate
 * space: composite on the left y-axis (0-100, --accent), close price on
 * the right y-axis ($, --info). Hover crosshair surfaces both values at
 * the same date.
 *
 * Per Terry S9 (task #78): "we've got to have some sort of line chart
 * for each so we can see the trend up or down etx over time" — the
 * v1 single-line composite shipped first; v2 adds price so the reader
 * can correlate score moves against the market's read in one canvas
 * instead of context-switching to a separate price page.
 *
 * Score history is weekly (Saturday chain); price is the matching
 * weekly close from prices_raw. Points where either is null are
 * dropped from the render (chart still aligns by index across both
 * arrays after the filter).
 *
 * Wrapped in a card per Instrument-Field §3.1 Inset role.
 */
const CHART_VIEW_W = 1200;
const CHART_H = 160;
const PADDING_Y = 8;
const AXIS_W = 44; // left/right gutter for y-axis labels

interface DualPoint {
  as_of: string;
  composite: number;
  price: number;
}

export function NameScoreChart({ history, ticker }: { history: NameSparkPoint[]; ticker: string }) {
  // Need both composite AND price non-null for the paired render. Drop
  // gaps. Live data with no prices_raw rows yet will fall through to the
  // insufficient-history banner — honest signal that price ingest hasn't
  // caught up to scoring yet.
  const points: DualPoint[] = history
    .filter((h) => h.composite != null && h.price != null)
    .map((h) => ({ as_of: h.as_of, composite: h.composite as number, price: h.price as number }));

  if (points.length < 2) {
    const reason =
      history.length >= 2 && history.some((h) => h.composite != null)
        ? `${ticker} has scored weeks but no aligned price data yet — chart renders once prices_raw catches up.`
        : `${ticker} needs ≥2 scored weeks before the chart renders.`;
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px dashed var(--border-subtle)",
          borderRadius: 6,
          padding: "10px 14px",
          color: "var(--text-4)",
          fontSize: 11.5,
          fontFamily: "var(--m)",
          fontStyle: "italic",
          alignSelf: "flex-start",
          maxWidth: 540,
          letterSpacing: ".01em",
        }}
      >
        Chart waiting on data — {reason}
      </div>
    );
  }

  const composites = points.map((p) => p.composite);
  const prices = points.map((p) => p.price);
  const dates = points.map((p) => p.as_of);

  const compFirst = composites[0];
  const compLast = composites[composites.length - 1];
  const compChange = Number((compLast - compFirst).toFixed(1));
  const compPositive = compChange >= 0;

  const priceFirst = prices[0];
  const priceLast = prices[prices.length - 1];
  const pricePct = ((priceLast - priceFirst) / priceFirst) * 100;
  const pricePositive = pricePct >= 0;

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
      {/* Header — title + paired delta strip */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Composite · price · {points.length}-week history
        </span>
        <div style={{ flex: 1 }} />
        <DeltaPill
          accent="var(--accent)"
          label="Score"
          from={compFirst.toFixed(1)}
          to={compLast.toFixed(1)}
          delta={`${compPositive ? "+" : ""}${compChange.toFixed(1)}`}
          deltaColor={compPositive ? "var(--success)" : "var(--danger)"}
        />
        <DeltaPill
          accent="var(--info)"
          label="Price"
          from={`$${priceFirst.toFixed(2)}`}
          to={`$${priceLast.toFixed(2)}`}
          delta={`${pricePositive ? "+" : ""}${pricePct.toFixed(1)}%`}
          deltaColor={pricePositive ? "var(--success)" : "var(--danger)"}
        />
      </div>

      {/* Chart canvas — left axis, chart, right axis */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, height: CHART_H }}>
        <YAxis side="left" min={Math.min(...composites)} max={Math.max(...composites)} format={(v) => v.toFixed(0)} color="var(--accent)" />
        <ChartWithHover composites={composites} prices={prices} dates={dates} />
        <YAxis
          side="right"
          min={Math.min(...prices)}
          max={Math.max(...prices)}
          format={(v) => `$${v.toFixed(v >= 100 ? 0 : 1)}`}
          color="var(--info)"
        />
      </div>
    </div>
  );
}

function DeltaPill({
  accent,
  label,
  from,
  to,
  delta,
  deltaColor,
}: {
  accent: string;
  label: string;
  from: string;
  to: string;
  delta: string;
  deltaColor: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        fontFamily: "var(--m)",
        fontSize: 12,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 8,
          height: 2,
          background: accent,
          marginRight: 4,
          alignSelf: "center",
        }}
      />
      <span style={{ color: "var(--text-3)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em" }}>
        {label}
      </span>
      <span style={{ color: "var(--text-3)" }}>
        {from} → {to}
      </span>
      <span style={{ color: deltaColor, fontWeight: 600 }}>{delta}</span>
    </span>
  );
}

function YAxis({
  side,
  min,
  max,
  format,
  color,
}: {
  side: "left" | "right";
  min: number;
  max: number;
  format: (v: number) => string;
  color: string;
}) {
  // 4 evenly-spaced ticks (min, 1/3, 2/3, max), display order top→bottom.
  const ticks = [max, max - (max - min) / 3, min + (max - min) / 3, min];
  return (
    <div
      style={{
        width: AXIS_W,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: `${PADDING_Y}px 0`,
        fontFamily: "var(--m)",
        fontSize: 10,
        color: "var(--text-4)",
        textAlign: side === "left" ? "right" : "left",
        flexShrink: 0,
        paddingRight: side === "left" ? 8 : 0,
        paddingLeft: side === "right" ? 8 : 0,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {ticks.map((t, i) => (
        <span key={i} style={{ color: i === 0 || i === ticks.length - 1 ? color : "var(--text-4)" }}>
          {format(t)}
        </span>
      ))}
    </div>
  );
}

function ChartWithHover({
  composites,
  prices,
  dates,
}: {
  composites: number[];
  prices: number[];
  dates: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number } | null>(null);

  // Composite scale (left axis)
  const cMin = Math.min(...composites);
  const cMax = Math.max(...composites);
  const cRange = cMax - cMin || 1;
  // Price scale (right axis)
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const pRange = pMax - pMin || 1;

  const usableH = CHART_H - PADDING_Y * 2;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (e.clientX - rect.left) / rect.width;
    const rawIdx = Math.round(relX * (composites.length - 1));
    const idx = Math.max(0, Math.min(composites.length - 1, rawIdx));
    setHover({ idx });
  }

  const hoverXPct = composites.length <= 1 ? 0 : (hover ? hover.idx / (composites.length - 1) : 0) * 100;
  const compY = hover ? PADDING_Y + (1 - (composites[hover.idx] - cMin) / cRange) * usableH : 0;
  const priceY = hover ? PADDING_Y + (1 - (prices[hover.idx] - pMin) / pRange) * usableH : 0;
  const compYPct = (compY / CHART_H) * 100;
  const priceYPct = (priceY / CHART_H) * 100;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
      style={{ flex: 1, position: "relative", cursor: "crosshair", height: "100%" }}
    >
      {/* Composite line — accent, filled */}
      <div style={{ position: "absolute", inset: 0 }}>
        <LineChart
          data={composites}
          width={CHART_VIEW_W}
          height={CHART_H}
          color="var(--accent)"
          strokeWidth={1.5}
          filled
          paddingY={PADDING_Y}
        />
      </div>
      {/* Price line — info, unfilled (would compete with composite area) */}
      <div style={{ position: "absolute", inset: 0 }}>
        <LineChart
          data={prices}
          width={CHART_VIEW_W}
          height={CHART_H}
          color="var(--info)"
          strokeWidth={1.5}
          paddingY={PADDING_Y}
        />
      </div>
      {hover && (
        <>
          {/* Crosshair vertical */}
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
          {/* Composite dot */}
          <Dot xPct={hoverXPct} yPct={compYPct} color="var(--accent)" />
          {/* Price dot */}
          <Dot xPct={hoverXPct} yPct={priceYPct} color="var(--info)" />
          <HoverTooltip
            composite={composites[hover.idx]}
            price={prices[hover.idx]}
            date={dates[hover.idx]}
            containerXPct={hoverXPct}
          />
        </>
      )}
    </div>
  );
}

function Dot({ xPct, yPct, color }: { xPct: number; yPct: number; color: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        width: 8,
        height: 8,
        marginLeft: -4,
        marginTop: -4,
        borderRadius: "50%",
        background: color,
        border: "2px solid var(--surface)",
        pointerEvents: "none",
      }}
    />
  );
}

function HoverTooltip({
  composite,
  price,
  date,
  containerXPct,
}: {
  composite: number;
  price: number;
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
        gap: 3,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        boxShadow: "0 2px 8px rgba(0,0,0,.4)",
        zIndex: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <Swatch color="var(--accent)" />
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
          {composite.toFixed(1)}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: ".04em" }}>SCORE</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <Swatch color="var(--info)" />
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
          ${price.toFixed(2)}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: ".04em" }}>PRICE</span>
      </div>
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 10,
          color: "var(--text-3)",
          letterSpacing: ".02em",
          lineHeight: 1.2,
          marginTop: 2,
        }}
      >
        {date}
      </span>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 8,
        height: 2,
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

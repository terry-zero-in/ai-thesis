"use client";

import { useMemo } from "react";
import { LineChart } from "@/components/primitives/LineChart";

/**
 * PortfolioHeroChart — small line chart + % change pill that sits in the
 * blank canvas to the right of the Market Value HeroNumber on /portfolio.
 *
 * Terry's S9 spec: "The blank space to the right of the amount invested
 * would be a good spot to put the % increase or decrase and then maybe a
 * line chart right on the canvas." Note "right on the canvas" = NOT in a
 * card (deliberate contrast with the Dashboard portfolio chart, which is
 * in a card because it has competing surfaces above it). This one is a
 * glance surface on the Portfolio hero, so it sits naked on canvas.
 *
 * No range picker, no hover tooltip — keep the surface quiet. The full
 * range-controlled, hover-enabled portfolio chart lives on /dashboard.
 */
const RANGE_DAYS = 30;
const CHART_W = 360;
const CHART_H = 60;

export function PortfolioHeroChart({
  currentValue,
  empty,
}: {
  currentValue: number;
  empty: boolean;
}) {
  const data = useMemo(() => synthesize(currentValue, RANGE_DAYS, empty), [currentValue, empty]);
  const startValue = data[0];
  const change = currentValue - startValue;
  const changePct = startValue > 0 ? (change / startValue) * 100 : 0;
  const positive = change >= 0;

  if (empty) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-end",
        minWidth: 0,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          30D
        </span>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 13,
            fontWeight: 600,
            color: positive ? "var(--success)" : "var(--danger)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {positive ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 11,
            color: "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {positive ? "+" : ""}${Math.abs(change).toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div style={{ width: CHART_W, height: CHART_H }}>
        <LineChart
          data={data}
          width={CHART_W}
          height={CHART_H}
          color="var(--accent)"
          strokeWidth={1.5}
          filled
        />
      </div>
    </div>
  );
}

/**
 * 30-day deterministic random walk anchored at currentValue. Matches the
 * pattern in PortfolioValueChart on /dashboard but without dates (no hover
 * here, no need). No drift — same lesson as the dashboard chart.
 */
function synthesize(currentValue: number, days: number, empty: boolean): number[] {
  if (empty || currentValue <= 0) return Array(days).fill(0);
  const seed = Math.floor(currentValue);
  const result: number[] = [];
  let v = currentValue;
  let s = seed;
  for (let i = 0; i < days; i++) {
    result.unshift(v);
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const noise = (s / 0x7fffffff - 0.5) * 0.012;
    v = v / (1 + noise);
    if (v < currentValue * 0.5) v = currentValue * 0.5;
    if (v > currentValue * 2) v = currentValue * 2;
  }
  return result;
}

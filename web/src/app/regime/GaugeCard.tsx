import { GAUGES, type GaugeKey, type MacroGaugeRow, type ThresholdHistory } from "@/lib/regime-types";

/**
 * Single gauge card — current reading, 12-month trend with threshold line,
 * hit chip if currently fired, and a hover-popover with historical hit
 * count + most-recent crossing.
 *
 * Sparkline rendered as pure SVG (no chart lib). Threshold line drawn as a
 * dashed horizontal at the gauge's threshold value, scaled into the
 * visible vertical extent of the actual series (so the line lands inside
 * the card even when readings sit far below/above it).
 */
export function GaugeCard({
  gauge,
  history,
  thresholdHistory,
}: {
  gauge: GaugeKey;
  history: MacroGaugeRow[];
  thresholdHistory: ThresholdHistory;
}) {
  const meta = GAUGES.find((g) => g.key === gauge)!;
  const values = history.map((h) => h[gauge]).filter((v): v is number => v != null);
  const latest = values[values.length - 1] ?? null;
  const fired = latest != null && latest > meta.threshold;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: ".08em",
            flex: 1,
          }}
        >
          {meta.label}
        </span>
        {fired && (
          <span
            style={{
              fontSize: 9.5,
              fontFamily: "var(--m)",
              color: "#FB7185",
              border: "1px solid rgba(251,113,133,.35)",
              background: "rgba(251,113,133,.06)",
              padding: "1px 6px",
              borderRadius: 3,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            gate hit
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 28,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: fired ? "#FB7185" : "var(--text-1)",
            lineHeight: 1,
          }}
        >
          {latest == null ? "—" : fmt(latest, gauge)}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
          gate at {fmt(meta.threshold, gauge)}
        </span>
      </div>

      <Trendline values={values} threshold={meta.threshold} range={meta.range} />

      <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{meta.blurb}</div>

      <div
        style={{
          fontSize: 10.5,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          paddingTop: 8,
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          {thresholdHistory.hits === 0
            ? "No crossings in last 52 weeks."
            : `${thresholdHistory.hits} crossing${thresholdHistory.hits === 1 ? "" : "s"} in last 52w`}
        </span>
        {thresholdHistory.last_hit_at && <span>last · {thresholdHistory.last_hit_at}</span>}
      </div>
    </div>
  );
}

function Trendline({
  values,
  threshold,
  range,
}: {
  values: number[];
  threshold: number;
  range: [number, number];
}) {
  if (values.length < 2) {
    return (
      <div style={{ fontSize: 11, color: "var(--text-4)", fontStyle: "italic" }}>
        Need ≥ 2 weekly readings to draw a trend.
      </div>
    );
  }
  const w = 360;
  const h = 64;
  const padX = 2;
  const padY = 6;
  const lo = Math.min(...values, threshold) - Math.abs(range[1] - range[0]) * 0.04;
  const hi = Math.max(...values, threshold) + Math.abs(range[1] - range[0]) * 0.04;
  const span = hi - lo || 1;
  const x = (i: number) => padX + (i / (values.length - 1)) * (w - padX * 2);
  const y = (v: number) => h - padY - ((v - lo) / span) * (h - padY * 2);

  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(" ");
  const yThresh = y(threshold);
  const lastIdx = values.length - 1;
  const lastV = values[lastIdx];
  const fired = lastV > threshold;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {/* Threshold dashed line */}
      <line
        x1={padX}
        x2={w - padX}
        y1={yThresh}
        y2={yThresh}
        stroke="#FB7185"
        strokeWidth={1}
        strokeDasharray="2 3"
        opacity={0.45}
      />
      <path d={path} fill="none" stroke={fired ? "#FB7185" : "var(--accent)"} strokeWidth={1.5} />
      {/* Latest dot */}
      <circle cx={x(lastIdx)} cy={y(lastV)} r={2.5} fill={fired ? "#FB7185" : "var(--accent)"} />
    </svg>
  );
}

function fmt(n: number, key: GaugeKey): string {
  if (key === "naaim") return n.toFixed(1);
  if (key === "aaii_3wk_spread") return (n > 0 ? "+" : "") + n.toFixed(1);
  return n.toFixed(0);
}

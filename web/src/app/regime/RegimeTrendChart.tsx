import { GAUGES, type GaugeKey, type MacroGaugeRow } from "@/lib/regime-types";

/**
 * 52-week trend chart for the 3 macro gauges — Master Design Spec §5.5:
 *   "Trend chart: 3 thin lines, color-coded subtly (NAAIM --accent,
 *    AAII --info, F&G --text-2). Threshold lines dashed --warning at the
 *    gate value for each. Today markers are 2px vertical lines in
 *    --text-1 with the value labeled at the right edge."
 *
 * Each series has a different real range (NAAIM 0–100, AAII −40…+60,
 * F&G 0–100). The chart normalizes each line into the same visual
 * y-domain [0,1] so they coexist legibly; the right-edge labels carry
 * the real-units value so the line is still readable as data.
 *
 * Threshold lines plot at each gauge's normalized threshold position;
 * the dashed colour matches the line colour (subtle) with a final
 * "▲{value}" anchor at the right edge.
 *
 * Server component — pure SVG, no client interactivity. Hover is
 * provided by the row tooltip on dot/label hover via `<title>`.
 */

const SERIES: { key: GaugeKey; color: string; labelColor: string }[] = [
  { key: "naaim", color: "var(--accent)", labelColor: "var(--accent)" },
  { key: "aaii_3wk_spread", color: "var(--info)", labelColor: "var(--info)" },
  { key: "fear_greed", color: "var(--text-2)", labelColor: "var(--text-2)" },
];

const VISIBLE_RANGE: Record<GaugeKey, [number, number]> = {
  naaim: [0, 100],
  aaii_3wk_spread: [-40, 60],
  fear_greed: [0, 100],
};

const W = 720;
const H = 220;
const PAD_L = 8;
const PAD_R = 96; // room for right-edge value labels
const PAD_T = 12;
const PAD_B = 26;

export function RegimeTrendChart({ history }: { history: MacroGaugeRow[] }) {
  if (history.length < 2) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-4)", fontStyle: "italic", padding: "10px 0" }}>
        Need ≥ 2 weekly readings to draw the trend.
      </div>
    );
  }

  const n = history.length;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const xAt = (i: number) => PAD_L + (i / (n - 1)) * innerW;
  const normY = (v: number, key: GaugeKey) => {
    const [lo, hi] = VISIBLE_RANGE[key];
    const t = (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo || 1);
    return PAD_T + (1 - t) * innerH;
  };

  const startLabel = history[0].as_of.slice(0, 7); // YYYY-MM
  const endLabel = history[n - 1].as_of.slice(0, 7);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          paddingBottom: 10,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          12-month trend
        </span>
        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
          {startLabel} → {endLabel}
        </span>
        <div style={{ flex: 1 }} />
        <Legend />
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", maxWidth: 960 }}
      >
        {/* y-grid hairlines at 0% / 50% / 100% of the normalized space */}
        {[0, 0.5, 1].map((t) => {
          const y = PAD_T + t * innerH;
          return (
            <line
              key={`grid-${t}`}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
          );
        })}

        {/* Per-gauge threshold line + label */}
        {SERIES.map(({ key, color }) => {
          const meta = GAUGES.find((g) => g.key === key)!;
          const y = normY(meta.threshold, key);
          return (
            <g key={`thresh-${key}`} opacity={0.45}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y}
                y2={y}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            </g>
          );
        })}

        {/* Series lines */}
        {SERIES.map(({ key, color }) => {
          const path = history
            .map((r, i) => {
              const v = r[key];
              if (v == null) return null;
              const x = xAt(i);
              const y = normY(v, key);
              return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .filter(Boolean)
            .join(" ");
          return <path key={`line-${key}`} d={path} fill="none" stroke={color} strokeWidth={1.4} />;
        })}

        {/* Today marker — vertical line at last x */}
        <line
          x1={xAt(n - 1)}
          x2={xAt(n - 1)}
          y1={PAD_T}
          y2={H - PAD_B}
          stroke="var(--text-1)"
          strokeWidth={2}
          opacity={0.55}
        />

        {/* Right-edge value labels for each series */}
        {SERIES.map(({ key, labelColor }, idx) => {
          const v = history[n - 1][key];
          const meta = GAUGES.find((g) => g.key === key)!;
          if (v == null) return null;
          const y = normY(v, key);
          // Avoid overlapping labels: shift up/down when within 12px of another.
          const shifted = avoidOverlap(
            y,
            SERIES.slice(0, idx).map((s) => {
              const sv = history[n - 1][s.key];
              return sv == null ? null : normY(sv, s.key);
            }),
          );
          const fmt = key === "fear_greed" ? v.toFixed(0) : key === "aaii_3wk_spread" ? (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) : v.toFixed(1);
          return (
            <g key={`label-${key}`}>
              <circle cx={xAt(n - 1)} cy={y} r={3} fill={labelColor} />
              <text
                x={xAt(n - 1) + 8}
                y={shifted + 3}
                fontSize={11}
                fontFamily="var(--m)"
                fill={labelColor}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {meta.label.split(" ")[0]} {fmt}
              </text>
            </g>
          );
        })}

        {/* x-axis date labels */}
        <text
          x={PAD_L}
          y={H - 8}
          fontSize={10}
          fontFamily="var(--m)"
          fill="var(--text-4)"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {startLabel}
        </text>
        <text
          x={W - PAD_R}
          y={H - 8}
          fontSize={10}
          fontFamily="var(--m)"
          fill="var(--text-4)"
          textAnchor="end"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {endLabel}
        </text>
      </svg>
    </div>
  );
}

function avoidOverlap(y: number, others: (number | null)[]): number {
  const MIN_GAP = 12;
  let candidate = y;
  for (const o of others) {
    if (o == null) continue;
    if (Math.abs(candidate - o) < MIN_GAP) {
      candidate = candidate > o ? o + MIN_GAP : o - MIN_GAP;
    }
  }
  return candidate;
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 14, fontSize: 11, fontFamily: "var(--m)" }}>
      {SERIES.map(({ key, color }) => {
        const meta = GAUGES.find((g) => g.key === key)!;
        return (
          <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-3)" }}>
            <span style={{ display: "inline-block", width: 10, height: 2, background: color, borderRadius: 1 }} />
            {meta.label.split(" ")[0]}
          </span>
        );
      })}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-4)" }}>
        <span
          style={{
            display: "inline-block",
            width: 10,
            height: 2,
            background: "var(--text-3)",
            borderRadius: 1,
            backgroundImage: "repeating-linear-gradient(90deg, var(--text-3) 0 3px, transparent 3px 6px)",
          }}
        />
        gate
      </span>
    </div>
  );
}

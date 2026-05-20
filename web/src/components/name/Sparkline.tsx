/**
 * 12-week composite sparkline. Pure SVG — no chart lib per the
 * "don't add libs casually" rule.
 *
 * Spec §4.9 threshold rules at composite 60 (Medium) and 75 (High) when
 * they fall within the visible y-domain. Lines are distinct line styles
 * (review §2.3 #8): Final = solid --accent; Composite = dashed
 * --text-3 — so they remain visually distinct even when values coincide
 * (multiplier = 1.0).
 */
import type { NameSparkPoint } from "@/lib/name-detail-data";

const THRESHOLDS = [
  { v: 60, label: "Medium" },
  { v: 75, label: "High" },
];

export function Sparkline({
  history,
  chartOnly = false,
  height = 130,
}: {
  history: NameSparkPoint[];
  /**
   * When true, drop the header strip (12-week history label + date range)
   * and the bottom legend (Final/Composite/range). Caller owns the textual
   * context. Used by NameHeader where the right-column hero provides those
   * labels directly. Defaults to false so any other consumer gets the full
   * self-contained sparkline.
   */
  chartOnly?: boolean;
  /**
   * SVG viewport height in px. Default 130 — bumped from 72 (S22) so the
   * sparkline carries real visual weight on the Name Detail right column
   * (Mercury Credit-Card Pic 19 b2 pattern, chart-as-counterweight to the
   * left-side hero number).
   */
  height?: number;
}) {
  if (history.length === 0) {
    return (
      <div style={{ fontSize: 11, color: "var(--text-4)", fontStyle: "italic" }}>
        No history yet — needs at least one Saturday cron run.
      </div>
    );
  }
  const w = 480;
  const h = height;
  const padX = 4;
  const padY = 6;
  const compositeVals = history.map((p) => p.composite).filter((v): v is number => v != null);
  const finalVals = history.map((p) => p.final_score).filter((v): v is number => v != null);
  // Threshold-aware y-domain: ensure 60 and 75 lie inside the visible
  // window when they're near the data (prevents lines stacking at the
  // chart edge when the score sits at e.g. 87).
  const all = [...compositeVals, ...finalVals];
  let min = Math.min(...all);
  let max = Math.max(...all);
  for (const t of THRESHOLDS) {
    if (Math.abs(t.v - min) < 10) min = Math.min(min, t.v - 2);
    if (Math.abs(t.v - max) < 10) max = Math.max(max, t.v + 2);
  }
  const range = max - min || 1;
  const x = (i: number) => padX + (i / Math.max(1, history.length - 1)) * (w - padX * 2);
  const y = (v: number) => h - padY - ((v - min) / range) * (h - padY * 2);

  const compositePath = pathFrom(history.map((p) => p.composite), x, y);
  const finalPath = pathFrom(history.map((p) => p.final_score), x, y);
  const last = history[history.length - 1];
  const first = history[0];

  // Visible thresholds — only render rules that sit inside [min, max]
  // (otherwise the line clips at the chart edge and reads as noise).
  const visibleThresholds = THRESHOLDS.filter((t) => t.v >= min && t.v <= max);

  return (
    // Mercury decard: format on canvas, no card chrome. Used both standalone
    // and inline within NameHeader as the right-side block (Pic 19 b2 pattern).
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      {!chartOnly && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              color: "var(--text-3)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            12-week history
          </span>
          <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
            {first.as_of} → {last.as_of}
          </span>
        </div>
      )}
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        {/* Threshold rules per spec §4.9 — hairlines at 60 + 75 */}
        {visibleThresholds.map((t) => {
          const ty = y(t.v);
          return (
            <g key={t.v}>
              <line
                x1={padX}
                x2={w - padX}
                y1={ty}
                y2={ty}
                stroke="var(--border-subtle)"
                strokeWidth={1}
              />
              <text
                x={w - padX - 2}
                y={ty - 3}
                fontSize={9}
                fontFamily="var(--m)"
                fill="var(--text-4)"
                textAnchor="end"
                style={{ fontVariantNumeric: "tabular-nums", letterSpacing: ".04em", textTransform: "uppercase" }}
              >
                {t.label.toUpperCase()} {t.v}
              </text>
            </g>
          );
        })}
        {/* Composite — dashed, muted */}
        <path
          d={compositePath}
          fill="none"
          stroke="var(--text-3)"
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.75}
        />
        {/* Final — solid, accent */}
        <path d={finalPath} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
        {history.map((p, i) =>
          p.final_score == null ? null : (
            <circle key={i} cx={x(i)} cy={y(p.final_score)} r={1.5} fill="var(--accent)" />
          ),
        )}
      </svg>
      {!chartOnly && (
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-3)" }}>
          <Legend color="var(--accent)" label={`Final · ${last.final_score?.toFixed(1) ?? "—"}`} dashed={false} />
          <Legend color="var(--text-3)" label={`Composite · ${last.composite?.toFixed(1) ?? "—"}`} dashed={true} />
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: "var(--m)" }}>
            {min.toFixed(1)} – {max.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          width: 10,
          height: 2,
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 2px, transparent 2px 4px)`
            : color,
          borderRadius: 1,
        }}
      />
      <span style={{ fontFamily: "var(--m)" }}>{label}</span>
    </span>
  );
}

function pathFrom(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  const parts: string[] = [];
  let started = false;
  values.forEach((v, i) => {
    if (v == null) {
      started = false;
      return;
    }
    parts.push(`${started ? "L" : "M"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`);
    started = true;
  });
  return parts.join(" ");
}

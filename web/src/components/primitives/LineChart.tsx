/**
 * LineChart — pure-SVG line chart primitive. No dependencies. Used by:
 *   - Sparkline (inline in KPI tiles, 80×24px)
 *   - PortfolioValueChart (canvas card, range-pill controlled)
 *   - Future per-name detail page (THS-78, locked S9)
 *
 * Composability: accepts data: number[] (y-values, x is implicit index).
 * Computes its own viewBox + path. Caller controls width/height/color.
 *
 * v1 = single-series only. Multi-series (e.g., score + price overlay)
 * is a v1.1 extension.
 */

interface LineChartProps {
  data: number[];
  width: number;
  height: number;
  /** Stroke color (CSS var or hex). Default: var(--accent). */
  color?: string;
  /** Stroke width in px. Default 1.5. */
  strokeWidth?: number;
  /** When true, fill area below the line with a 12% opacity gradient. */
  filled?: boolean;
  /** Top + bottom padding inside the chart so endpoints aren't clipped. */
  paddingY?: number;
}

export function LineChart({
  data,
  width,
  height,
  color = "var(--accent)",
  strokeWidth = 1.5,
  filled = false,
  paddingY = 2,
}: LineChartProps) {
  if (data.length < 2) {
    return <svg width={width} height={height} aria-hidden />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const usableH = height - paddingY * 2;
  const step = data.length === 1 ? 0 : width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = paddingY + (1 - (v - min) / range) * usableH;
    return [x, y] as const;
  });

  const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const areaPath = filled
    ? `${path} L${points[points.length - 1][0]},${height} L0,${height} Z`
    : null;

  const gradientId = `lc-grad-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {filled && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Sparkline — thin wrapper for inline use in KPI tiles. Color defaults to
 * var(--accent); caller can override for semantic-color cases (e.g. Macro
 * Multiplier tile passes the regime-state color). Trend information lives
 * in the numeric chip beside the value, not in the line itself — /lambo:
 * "severity colors only at severity moments."
 */
export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "var(--accent)",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  return <LineChart data={data} width={width} height={height} color={color} strokeWidth={1.25} filled />;
}

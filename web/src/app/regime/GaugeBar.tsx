/**
 * GaugeBar — horizontal threshold gauge per Master Design Spec §4.3 / §5.5.
 *
 * Replaces the prior wavy sparkline (review §2.5 #2). Spec literal:
 *   "horizontal bar with threshold tick + current marker + numeric scale
 *    (0…50…90▲100). The wave is decorative; the bar is dispositive."
 *
 * Composition (left → right):
 *   ─ track (full visible range, --border-subtle)
 *   ─ filled segment (0 → current value, --accent or --warning if fired)
 *   ─ current-value dot at the value position
 *   ─ threshold tick (▲) sitting on the bar at the threshold position
 *   ─ numeric scale labels: min / mid / threshold / max
 *
 * Renders as inline SVG (no chart lib). Caps the visible range to the
 * meaningful zone — NAAIM declared range [0, 200] but operators read
 * 0-100; clamping the visible axis keeps the bar legible.
 */

interface Props {
  value: number | null;
  threshold: number;
  /** Algorithmic plausible range. Visible window may be tightened (see VISIBLE_RANGE). */
  range: [number, number];
  fired: boolean;
}

/**
 * Tightened visible window per gauge — keeps the bar interpretable when the
 * declared range is wider than what an operator reads against day to day.
 * If no override for a (threshold, range) signature, the declared range wins.
 */
function visibleRangeFor(threshold: number, range: [number, number]): [number, number] {
  // NAAIM: declared [0, 200], threshold 90 — operators read 0-100.
  if (threshold === 90 && range[1] >= 100) return [0, 100];
  return range;
}

export function GaugeBar({ value, threshold, range, fired }: Props) {
  const [lo, hi] = visibleRangeFor(threshold, range);
  const span = hi - lo || 1;
  const pos = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / span) * 100;
  const valuePos = value == null ? null : pos(value);
  const threshPos = pos(threshold);
  const valueColor = fired ? "var(--warning)" : "var(--accent)";
  const fillColor = fired ? "var(--warning)" : "var(--accent)";

  // Scale anchors: min, midpoint, threshold (if not coincident with min/mid/max), max.
  const mid = (lo + hi) / 2;
  const anchors: { v: number; label: string; isThreshold: boolean }[] = [
    { v: lo, label: fmtInt(lo), isThreshold: false },
  ];
  if (Math.abs(threshold - mid) > span * 0.06) {
    anchors.push({ v: mid, label: fmtInt(mid), isThreshold: false });
  }
  anchors.push({ v: threshold, label: `▲${fmtInt(threshold)}`, isThreshold: true });
  anchors.push({ v: hi, label: fmtInt(hi), isThreshold: false });
  // Dedupe values within 4% of each other; prefer the threshold entry.
  const dedup = anchors.filter((a, i) => {
    return !anchors.some((b, j) => j < i && Math.abs(b.v - a.v) / span < 0.04 && b.isThreshold);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* The bar */}
      <div style={{ position: "relative", height: 8 }}>
        {/* Track */}
        <div
          style={{
            position: "absolute",
            inset: "3px 0",
            background: "var(--border-subtle)",
            borderRadius: 1,
          }}
        />
        {/* Fill (0 → current) */}
        {valuePos != null && (
          <div
            style={{
              position: "absolute",
              top: 3,
              bottom: 3,
              left: 0,
              width: `${valuePos}%`,
              background: fillColor,
              opacity: 0.55,
              borderRadius: 1,
            }}
          />
        )}
        {/* Threshold tick mark (line) */}
        <div
          title={`Gate threshold ${fmtInt(threshold)}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${threshPos}%`,
            width: 1,
            background: "var(--text-2)",
            opacity: 0.7,
          }}
        />
        {/* Current value marker dot */}
        {valuePos != null && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: `${valuePos}%`,
              transform: "translate(-50%, -50%)",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: valueColor,
              boxShadow: "0 0 0 2px var(--surface)",
            }}
          />
        )}
      </div>
      {/* Numeric scale anchors */}
      <div style={{ position: "relative", height: 14 }}>
        {dedup.map((a) => (
          <span
            key={a.v}
            style={{
              position: "absolute",
              left: `${pos(a.v)}%`,
              transform: "translateX(-50%)",
              fontSize: 10,
              fontFamily: "var(--m)",
              color: a.isThreshold ? "var(--text-2)" : "var(--text-4)",
              fontWeight: a.isThreshold ? 500 : 400,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {a.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function fmtInt(n: number): string {
  // AAII spread can be negative; preserve sign. Others are non-negative.
  if (n < 0) return n.toFixed(0);
  return Math.round(n).toString();
}

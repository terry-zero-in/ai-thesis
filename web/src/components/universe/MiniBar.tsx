/**
 * Compact 0-100 horizontal bar used for Q/G/V/AIQ columns in the universe
 * table. Tabular numerals on the right so columns line up even when scores
 * vary in digit count. Bar fill clamped to [0,100].
 *
 * Null vs low-score distinction: `value == null` renders "n/a" (not "—")
 * with a `title` tooltip naming the missing factor — surfaces coverage
 * gaps as a different signal from a genuinely low score. Per /universe
 * review item 3 (AIQ coverage-gap clarity).
 *
 * 50-mark tick: faint vertical line at 50% of the track gives "above /
 * below median" read at a glance — eyeballing whether a 46 is below
 * average no longer requires arithmetic. Per /universe review item 5.
 */
export function MiniBar({ label, value }: { label: string; value: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const shown = value == null ? "n/a" : Math.round(value).toString();
  const nullTitle = value == null ? `${label} not yet scored for this name` : undefined;
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
      title={nullTitle}
    >
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 10,
          color: "var(--text-4)",
          letterSpacing: ".04em",
          width: 12,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          height: 4,
          minWidth: 32,
          background: "rgba(255,255,255,.04)",
          borderRadius: 2,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* 50-mark reference tick — anchors above/below-median read */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(255,255,255,.10)",
            pointerEvents: "none",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background:
              value == null
                ? "transparent"
                : pct >= 75
                ? "var(--accent)"
                : pct >= 50
                ? "color-mix(in oklab, var(--accent) 65%, var(--text-3))"
                : "var(--text-3)",
            borderRadius: 2,
          }}
        />
      </span>
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 10.5,
          fontVariantNumeric: "tabular-nums",
          color: value == null ? "var(--text-4)" : "var(--text-2)",
          fontStyle: value == null ? "italic" : undefined,
          width: 24,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {shown}
      </span>
    </div>
  );
}

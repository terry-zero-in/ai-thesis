/**
 * Compact 0-100 horizontal bar used for Q/G/V/AIQ columns in the universe
 * table. Tabular numerals on the right so columns line up even when scores
 * vary in digit count. Bar fill clamped to [0,100].
 */
export function MiniBar({ label, value }: { label: string; value: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const shown = value == null ? "—" : Math.round(value).toString();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
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
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background:
              value == null
                ? "var(--text-4)"
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
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          color: value == null ? "var(--text-4)" : "var(--text-2)",
          width: 20,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {shown}
      </span>
    </div>
  );
}

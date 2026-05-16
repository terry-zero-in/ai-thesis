const COLORS: Record<number, string> = {
  1: "#7DD3FC", // L1 Compute   — cyan
  2: "#A78BFA", // L2 Hyperscaler — violet
  3: "#34D399", // L3 App        — green
  4: "#FACC15", // L4 Power      — amber
  5: "#94A3B8", // L5 Incumbent  — slate
};

export function LayerChip({ layer, label }: { layer: number; label: string }) {
  const color = COLORS[layer] ?? "var(--text-3)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontFamily: "var(--m)", fontSize: 10, color: "var(--text-3)" }}>L{layer}</span>
      <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{label}</span>
    </span>
  );
}

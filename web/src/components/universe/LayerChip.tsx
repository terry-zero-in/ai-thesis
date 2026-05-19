// Categorical layer encoding — kept literal because layer colors are not defined
// as tokens (S4 2026-05-18). Five distinct categorical hues so every layer reads
// as its own thing.
//
// L2 history: was #A78BFA violet under the iris-accent regime (v1.1). After the
// 2026-05-19 palette pivot to electric-blue --accent (#2A5FE6), Terry directed
// the cascade to "carry through" layer dots. L2 moved to #6E7BE8 — a
// violet-leaning electric blue that's part of the new accent family but
// categorically distinct from --accent (lighter, more violet) so it doesn't
// read as "active state."
const COLORS: Record<number, string> = {
  1: "#5BC0DE",        // L1 Compute     — cool teal-cyan
  2: "#6E7BE8",        // L2 Hyperscaler — violet-leaning electric blue (v1.2)
  3: "var(--success)", // L3 App         — green
  4: "var(--warning)", // L4 Power       — amber
  5: "var(--frost-500)", // L5 Incumbent — frost
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

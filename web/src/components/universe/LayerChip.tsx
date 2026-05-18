// Categorical layer encoding — kept literal because layer colors are not defined
// in the Iris × Voltage spec (S4 2026-05-18). Five distinct categorical hues so
// every layer reads as its own thing. L1 used to be --accent (Apex blue); after
// the Iris migration --accent collides with L2 violet, so L1 moved to a cool
// teal/cyan to preserve "compute = cool-blue" identity.
const COLORS: Record<number, string> = {
  1: "#5BC0DE",        // L1 Compute     — cool teal-cyan
  2: "#A78BFA",        // L2 Hyperscaler — violet
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

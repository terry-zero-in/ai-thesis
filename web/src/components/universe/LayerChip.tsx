// Categorical layer encoding — five distinct categorical pastel hues per the
// Iris × Voltage v2.0 deck (S20). The colors live ONLY on the 8px leading
// dot, never as fill or row tint — per /lambo "severity colors only at
// severity moments." Layer is an identifier, not a state, so the chip itself
// is inline-text style (no pill bg) when used in dense table rows; the dot
// + label carry the signal.
//
//   L1 Compute     · Cyan   #67E8F9 — cool cyan
//   L2 Hyperscaler · Sky    #7DD3FC — sky blue
//   L3 App         · Mint   #6EE7B7 — pastel emerald
//   L4 Power       · Amber  #F5C268 — pastel amber
//   L5 Incumbent   · Slate  #8A92A6 — neutral slate
const COLORS: Record<number, string> = {
  1: "#67E8F9", // L1 Compute     — Cyan
  2: "#7DD3FC", // L2 Hyperscaler — Sky
  3: "#6EE7B7", // L3 App         — Mint (= --success-text)
  4: "#F5C268", // L4 Power       — Amber (= --warning-text)
  5: "#8A92A6", // L5 Incumbent   — Slate
};

export function LayerChip({ layer, label }: { layer: number; label: string }) {
  const color = COLORS[layer] ?? "var(--text-3)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      <span
        style={{
          width: 8,
          height: 8,
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

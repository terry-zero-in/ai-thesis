import type { Tier } from "@/lib/universe-data";

const STYLES: Record<Tier, { fg: string; bg: string; border: string }> = {
  High:   { fg: "#7DD3FC", bg: "rgba(125,211,252,.10)", border: "rgba(125,211,252,.30)" },
  Medium: { fg: "#D6D6D6", bg: "rgba(214,214,214,.06)", border: "rgba(214,214,214,.22)" },
  Low:    { fg: "#FACC15", bg: "rgba(250,204,21,.08)",  border: "rgba(250,204,21,.30)" },
  Avoid:  { fg: "#FB7185", bg: "rgba(251,113,133,.10)", border: "rgba(251,113,133,.32)" },
};

export function TierBadge({ tier }: { tier: Tier | null }) {
  if (!tier) return <span style={{ color: "var(--text-4)", fontSize: 11, fontFamily: "var(--m)" }}>—</span>;
  const s = STYLES[tier];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 3,
        fontSize: 10,
        fontFamily: "var(--m)",
        fontWeight: 500,
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border}`,
        letterSpacing: 0,
        whiteSpace: "nowrap",
      }}
    >
      {tier}
    </span>
  );
}

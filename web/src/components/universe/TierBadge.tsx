import type { Tier } from "@/lib/universe-data";

/**
 * Tier → token mapping per AI Thesis Master Design Spec §2.1, §4.1, §4.6:
 *   "High conviction tier uses indigo because *we* believe in it;
 *    Medium = warning amber, Low = info blue, Avoid = danger red."
 * Previously hardcoded Reticle-derived sky-blue/gray/yellow/pink values
 * that didn't bind to the spec'd accent system. Swapped 2026-05-17.
 */
const STYLES: Record<Tier, { fg: string; bg: string; border: string }> = {
  High:   { fg: "var(--accent)",  bg: "var(--accent-soft)",  border: "var(--accent-border)" },
  Medium: { fg: "var(--warning)", bg: "var(--warning-soft)", border: "rgba(221,168,90,.30)" },
  Low:    { fg: "var(--info)",    bg: "var(--info-soft)",    border: "rgba(101,148,232,.30)" },
  Avoid:  { fg: "var(--danger)",  bg: "var(--danger-soft)",  border: "rgba(224,120,120,.32)" },
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

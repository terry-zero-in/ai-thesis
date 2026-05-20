import type { Tier } from "@/lib/universe-data";

/**
 * Tier → token mapping. v1.2 (2026-05-19) shifted to a semantic traffic-light
 * mapping after the palette pivot collapsed High and Low onto the same hex
 * (both --accent post-info-rebind) and Terry flagged the High/Low visual
 * collision. Supersedes the prior Master Design Spec §2.1/§4.1/§4.6
 * "indigo-for-conviction" treatment — that decision was poetic but
 * institutionally counter-intuitive once accent moved to electric blue.
 * Universal analyst convention: green=long, amber=caution, red=avoid.
 *
 *   High   = success green   (long, conviction)
 *   Medium = text-1 neutral  (no edge)
 *   Low    = warning amber   (de-rated)
 *   Avoid  = danger red      (do not touch)
 */
const STYLES: Record<Tier, { fg: string; bg: string; border: string }> = {
  High:   { fg: "var(--success)", bg: "var(--success-soft)", border: "rgba(48,209,88,.30)" },
  Medium: { fg: "var(--text-1)",  bg: "rgba(255,255,255,.04)", border: "var(--border)" },
  Low:    { fg: "var(--warning)", bg: "var(--warning-soft)", border: "rgba(221,168,90,.30)" },
  Avoid:  { fg: "var(--danger)",  bg: "var(--danger-soft)",  border: "rgba(229,72,77,.32)" },
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

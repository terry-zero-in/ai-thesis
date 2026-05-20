import type { Tier } from "@/lib/universe-data";

/**
 * Tier → token mapping. v2.0 (S20 2026-05-20): migrated to the pastel-tier
 * chip system per Iris × Voltage deck. Tier is an *identity label* so the
 * chip uses a fully rounded pill (radius 9999) with pastel text on a faint
 * fill (~8%) + faint border (~25%) in the same channel. The solid semantic
 * tier (--success/warning/danger) stays for dots, focus rings, and primary
 * state moments — not chip text.
 *
 *   High   = mint pastel   (long, conviction)
 *   Medium = frost neutral (no edge)
 *   Low    = amber pastel  (de-rated)
 *   Avoid  = coral pastel  (do not touch)
 */
const STYLES: Record<Tier, { fg: string; bg: string; border: string }> = {
  High:   { fg: "var(--success-text)", bg: "var(--success-text-fill)", border: "var(--success-text-border)" },
  Medium: { fg: "var(--text-2)",       bg: "rgba(255,255,255,.05)",    border: "rgba(255,255,255,.18)" },
  Low:    { fg: "var(--warning-text)", bg: "var(--warning-text-fill)", border: "var(--warning-text-border)" },
  Avoid:  { fg: "var(--danger-text)",  bg: "var(--danger-text-fill)",  border: "var(--danger-text-border)" },
};

export function TierBadge({ tier }: { tier: Tier | null }) {
  if (!tier) return <span style={{ color: "var(--text-4)", fontSize: 11, fontFamily: "var(--m)" }}>—</span>;
  const s = STYLES[tier];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 9px",
        borderRadius: 9999,
        fontSize: 10,
        fontFamily: "var(--m)",
        fontWeight: 500,
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border}`,
        letterSpacing: ".02em",
        whiteSpace: "nowrap",
      }}
    >
      {tier}
    </span>
  );
}

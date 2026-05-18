import type { ReactNode } from "react";

/**
 * Mono Meta Spine — signature pattern #1 across analytical surfaces.
 *
 * One quiet single-line anchor in JetBrains Mono that signals
 * provenance (as_of), versioning (engine), state (macro multiplier),
 * and cadence (when the chain runs). Sits as a hairline beneath the
 * page header.
 *
 * Three properties of a signature pattern:
 *   1. Reusable — works on Dashboard, Universe, Detail, Decisions, Regime.
 *   2. Recognizable — a user who's seen one recognizes it on a new page.
 *   3. Earned — answers "where did this come from / when did it compute?"
 *      without forcing a hover or a click.
 *
 * Render `null`/empty segments will be filtered, so callers can pass
 * undefined for pieces a given surface doesn't have (e.g., Regime page
 * doesn't need an engine version because it's a state reading, not a
 * computation).
 */
export interface SpineSegment {
  label: string;
  value?: ReactNode;
}

export function MonoMetaSpine({ segments }: { segments: SpineSegment[] }) {
  const visible = segments.filter((s) => s.value !== null && s.value !== undefined && s.value !== "");
  if (visible.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0 14px",
        fontSize: 11,
        fontFamily: "var(--m)",
        color: "var(--text-3)",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.4,
        paddingBottom: 2,
      }}
    >
      {visible.map((s, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
          {i > 0 && <span style={{ color: "var(--text-4)", marginRight: 6 }}>·</span>}
          <span style={{ color: "var(--text-4)" }}>{s.label}</span>
          <span style={{ color: "var(--text-2)" }}>{s.value}</span>
        </span>
      ))}
    </div>
  );
}

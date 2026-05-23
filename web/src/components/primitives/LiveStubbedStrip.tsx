import type { ReactNode } from "react";

/**
 * Live/Stubbed factor strip — THS-73 sub-pattern #3, /universe only.
 *
 * One-line mono strip that surfaces which composite factors are live
 * vs. qualitative-only in the current engine version:
 *
 *   Live factors: Q · G · V · AIQ          Stubbed: M · S          Mode: Tier-A Composite
 *
 * Live segment uses --text-1 (the engaged-color); Stubbed segment uses
 * --text-3 (muted) — at a glance the reader knows what's powering the
 * scores without having to read a paragraph. The trailing Mode echo
 * matches the sitewide engine-status strip's `mode` segment so the two
 * lines reinforce each other.
 *
 * Lives just below the Universe page header (above the table). Static
 * content for now — when M+S go live and enter the composite, swap the
 * two M/S segments into the live group and update the mode label.
 */
const LIVE_FACTORS = ["Q", "G", "V", "AIQ"];
const STUBBED_FACTORS = ["M", "S"];

export function LiveStubbedStrip({ mode = "Tier-A Composite" }: { mode?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0 24px",
        padding: "8px 32px 10px",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: 11,
        fontFamily: "var(--m)",
        color: "var(--text-3)",
        background: "var(--canvas)",
        flexShrink: 0,
        lineHeight: 1.4,
      }}
      aria-label="Live vs. stubbed factors"
    >
      <Group label="Live factors" items={LIVE_FACTORS} color="var(--text-1)" />
      <Group label="Stubbed" items={STUBBED_FACTORS} color="var(--text-3)" />
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, marginLeft: "auto" }}>
        <span style={{ color: "var(--text-4)" }}>Mode:</span>
        <span style={{ color: "var(--text-2)", fontWeight: 600 }}>{mode}</span>
      </span>
    </div>
  );
}

function Group({
  label,
  items,
  color,
}: {
  label: string;
  items: string[];
  color: string;
}): ReactNode {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
      <span style={{ color: "var(--text-4)" }}>{label}:</span>
      {items.map((it, i) => (
        <span key={it} style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          {i > 0 && <span style={{ color: "var(--text-4)" }}>·</span>}
          <span style={{ color, fontWeight: 500 }}>{it}</span>
        </span>
      ))}
    </span>
  );
}

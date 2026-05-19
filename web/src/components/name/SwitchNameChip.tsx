"use client";

import { useShellControls } from "@/hooks/shell-controls-context";

/**
 * Clickable chip next to the ticker on Name Detail — opens the global
 * ⌘K palette so the user can search-and-jump to any of the 50 names in
 * the universe without leaving the page. Replaces a muted text-4 hint
 * that was too quiet to discover.
 *
 * Visual: small bordered pill, mono, text-2 color, hover lifts to text-1
 * with surface-hover background and `.lin-hov` transition. Keyboard
 * shortcut chip (⌘K) sits inside the pill so the affordance also
 * teaches the binding.
 */
export function SwitchNameChip() {
  const { openCmd } = useShellControls();
  return (
    <button
      type="button"
      onClick={openCmd}
      className="lin-hov"
      title="Switch to any name in the universe (⌘K)"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontFamily: "var(--m)",
        color: "var(--text-2)",
        background: "transparent",
        border: "1px solid var(--border-subtle)",
        borderRadius: 4,
        padding: "3px 8px",
        marginLeft: 8,
        cursor: "pointer",
        letterSpacing: ".01em",
        whiteSpace: "nowrap",
      }}
    >
      Switch name
      <span
        className="k"
        style={{
          fontSize: 10,
          padding: "1px 4px",
          opacity: 0.85,
        }}
      >
        ⌘K
      </span>
    </button>
  );
}

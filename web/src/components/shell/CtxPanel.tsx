"use client";

import { useCtxPanel } from "@/hooks/ctx-panel-context";
import { useUniverseFilter } from "@/hooks/universe-filter-context";
import { UniverseFilterRail } from "@/components/universe/UniverseFilterRail";

/**
 * CtxPanel — right-side context panel.
 *
 * Pages register their rail key on mount (effect → ctx-panel-context.setRail)
 * and this component switches the rendered surface on that key. New rails
 * land here as each page ships:
 *   - "universe-filter" → Layer / Tier filter chips for /universe (THS-52)
 *   - "regime-history"  → upcoming for /regime (THS-56)
 *   - …
 *
 * Default (no key registered, or key not handled) is a 320px placeholder so
 * the layout math doesn't change when ⌘\\ opens an empty panel during dev.
 */
export function CtxPanel() {
  const { rail } = useCtxPanel();
  return (
    <aside
      style={{
        width: 320,
        background: "var(--surface)",
        margin: "8px 8px 8px 0",
        borderRadius: 8,
        border: "1px solid #1A1B1E",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {rail === "universe-filter" ? <UniverseFilterPanel /> : <Placeholder />}
    </aside>
  );
}

function UniverseFilterPanel() {
  const f = useUniverseFilter();
  return (
    <UniverseFilterRail
      layers={f.layers}
      tiers={f.tiers}
      onToggleLayer={f.toggleLayer}
      onToggleTier={f.toggleTier}
      onClear={f.clear}
      totalRows={f.totalRows}
      visibleRows={f.visibleRows}
      asOf={f.asOf}
      synthetic={f.synthetic}
    />
  );
}

function Placeholder() {
  return (
    <>
      <div
        style={{
          padding: "14px 16px",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-3)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        Context
      </div>
      <div
        style={{
          flex: 1,
          padding: "20px 16px",
          fontSize: 12,
          color: "var(--text-3)",
          lineHeight: 1.6,
        }}
      >
        Page-level rail content lands here as each surface ships. ⌘\ toggles.
      </div>
    </>
  );
}

"use client";

/**
 * CtxPanel — right-side context panel.
 *
 * In Reticle this hosted six rails (Agent/Routine/Delegation, To-Do, Capture,
 * Log, Notes/Filter). Those were Reticle-domain-specific; AI Thesis pages
 * will register their own contextual rails as they ship (THS-52 universe
 * filter, THS-56 regime gauge timeline, etc.). Until then this is a
 * placeholder that proves the chrome — the panel opens/closes via ⌘\\ and
 * the panel toggle in TopBar — without any rail content.
 *
 * Placeholder uses the same outer shell as Reticle's CtxPanel (320px,
 * surface bg, rounded border, margin from canvas) so the layout math
 * doesn't change when rails get filled in later.
 */
export function CtxPanel() {
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
    </aside>
  );
}

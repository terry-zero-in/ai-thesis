/**
 * GoToPill — bottom-center hint that surfaces while G-prefix navigation is
 * awaiting a follow-up key. Fade-in 140ms, non-interactive (pointerEvents:none).
 *
 * Mirror of the G-prefix map in `useShellKeyboard.ts`. Keep in sync —
 * displayed hints must match handler behavior or users press dead keys.
 */
const ROUTES: [string, string][] = [
  ["D", "Dash"],
  ["U", "Universe"],
  ["P", "Portfolio"],
  ["R", "Regime"],
  ["A", "AIQ"],
  ["M", "Memos"],
  ["X", "Decisions"],
  ["B", "Backtest"],
];

export function GoToPill({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 22,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 240,
        background: "var(--elevated)",
        border: "1px solid var(--accent-border)",
        borderRadius: 8,
        padding: "6px 10px 6px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 10px 32px rgba(0,0,0,.55), 0 0 0 1px var(--accent-soft)",
        animation: "fadeUpSm var(--dur-fast) var(--ease-out) both",
        pointerEvents: "none",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 0 6px var(--accent-glow)",
            animation: "pulse 1.2s var(--ease) infinite",
          }}
        />
        <span style={{ fontSize: 11.5, color: "var(--text-1)", letterSpacing: "-.005em", fontWeight: 500 }}>
          Go to…
        </span>
      </span>
      <span style={{ width: 1, height: 14, background: "var(--border)" }} />
      <span
        style={{
          display: "flex",
          gap: 5,
          alignItems: "center",
          fontFamily: "var(--m)",
          fontSize: 10,
          color: "var(--text-3)",
        }}
      >
        {ROUTES.map(([k, l], i) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span className="k" style={{ minWidth: 14, textAlign: "center" }}>
              {k}
            </span>
            <span style={{ color: "var(--text-3)" }}>{l}</span>
            {i < ROUTES.length - 1 && <span style={{ color: "var(--text-4)", marginLeft: 1 }}>·</span>}
          </span>
        ))}
      </span>
      <span style={{ width: 1, height: 14, background: "var(--border)" }} />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 10.5,
          color: "var(--text-3)",
        }}
      >
        <span className="k">esc</span>
        <span>cancel</span>
      </span>
    </div>
  );
}

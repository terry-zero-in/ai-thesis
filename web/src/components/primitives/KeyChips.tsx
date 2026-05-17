/**
 * KeyChips — renders a sequence of keyboard keys with optional 'then' connector.
 * Used by Tip + ShortcutsOverlay.
 */
export function KeyChips({ keys }: { keys: string[] }) {
  return (
    <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {keys.map((k, i) =>
        k === "then" ? (
          <span
            key={i}
            style={{
              fontSize: 9.5,
              color: "var(--text-3)",
              letterSpacing: ".02em",
              padding: "0 1px",
            }}
          >
            then
          </span>
        ) : (
          <span key={i} className="k">
            {k}
          </span>
        ),
      )}
    </span>
  );
}

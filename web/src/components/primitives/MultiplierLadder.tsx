/**
 * MultiplierLadder — equal-width horizontal step row with one step active.
 *
 * Signature pattern per docs/design/lambo-review-2026-05-17.md §4.2
 * (Pattern #3). Generalizes the /regime "Curve" cell (gates 0/1/2/3 →
 * multipliers 1.00/0.95/0.90/0.85, active state highlighted).
 *
 * Per /lambo "one more gate would tighten" — the ladder lets the operator
 * read at-a-glance both (a) current state and (b) what the next step is.
 *
 * Active state lift per Terry's [[feedback_active_state_surface_lift]]:
 * background --accent-soft, 1px --accent-border, value text --accent.
 * Inactive: transparent bg, transparent border (no false clickability),
 * --text-2 value. Only the active step earns a visible boundary, so the
 * row reads "one moment among a sequence" rather than "four buttons."
 *
 * Reuse candidates:
 *   - /regime macro-multiplier-by-gates (the founding case)
 *   - /universe tier cutpoint visualization (High ≥75, Med ≥60, Low ≥45, Avoid <45)
 *   - /aiq dimension cap rows (Disclosure 0…20, Defensibility 0…20, …)
 *   - factor weight ladders (Q 0.30, G 0.25, V 0.20, S 0.15, M 0.10)
 */
export interface LadderStep {
  /** Stable identity for active-match + React key. */
  key: string | number;
  /** Small-caps label on top of the cell (e.g. "0 gates" / "1 gate"). */
  label: string;
  /** Value text on the second line (e.g. "1.00" / "0.95"). Caller pre-formats. */
  value: string;
  /** Optional third-line caption (e.g. "clean tape" / "caution"). 10.5px --text-4. */
  caption?: string;
}

interface MultiplierLadderProps {
  steps: LadderStep[];
  /** Which step's `key` matches the active state. Null = no active step. */
  activeKey: string | number | null;
  /** Cell gap in px. Default 4. */
  gap?: number;
}

export function MultiplierLadder({ steps, activeKey, gap = 4 }: MultiplierLadderProps) {
  return (
    <div style={{ display: "flex", gap, marginTop: 4 }}>
      {steps.map((s) => {
        const active = s.key === activeKey;
        return (
          <div
            key={s.key}
            style={{
              flex: 1,
              padding: "6px 8px",
              textAlign: "center",
              background: active ? "var(--accent-soft)" : "transparent",
              border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
              borderRadius: 4,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                fontFamily: "var(--m)",
                letterSpacing: ".06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: "var(--m)",
                fontSize: 14,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: active ? "var(--accent)" : "var(--text-2)",
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {s.value}
            </div>
            {s.caption && (
              <div
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--m)",
                  color: "var(--text-4)",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.caption}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

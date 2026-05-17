/**
 * Rail building-block primitives shared across all per-page rails.
 *
 * Mercury "format on canvas, no card chrome" applied INSIDE the rail aside —
 * sections separated by hairlines + 10.5px small-caps section labels in
 * --text-3. Matches UniverseFilterRail's Header/Section pattern but exposed
 * for cross-rail reuse.
 *
 * The aside chrome itself (320px width, border, border-radius) is owned by
 * CtxPanel.tsx per S2 handoff Override #1.
 */
import type { ReactNode } from "react";

export function RailHeader({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-3)",
        letterSpacing: ".06em",
        textTransform: "uppercase",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {right}
    </div>
  );
}

export function RailSection({
  title,
  right,
  children,
  divider = true,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  /** Bottom hairline. Default true; pass false on the last section to avoid double-divider with footer. */
  divider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 16px 14px",
        borderBottom: divider ? "1px solid var(--border-subtle)" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
      </div>
      {children}
    </div>
  );
}

export function RailEmpty({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        color: "var(--text-3)",
        lineHeight: 1.55,
        fontFamily: "var(--f)",
      }}
    >
      {children}
    </div>
  );
}

export function RailGhost({ ticket, label }: { ticket: string; label: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "var(--text-4)",
        lineHeight: 1.5,
        fontFamily: "var(--m)",
      }}
    >
      <span style={{ color: "var(--text-3)" }}>{ticket}</span> {label}
    </div>
  );
}

export function RailFooter({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 11,
        color: "var(--text-3)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

/**
 * Quiet Action Row — signature pattern #3 across analytical surfaces.
 *
 * Every per-row action (edit, close, ack, sell, detail ↗) is hidden by
 * default and revealed on row hover OR keyboard focus. No borders, no
 * backgrounds — just borderless mono text + a directional glyph
 * (→ for in-context navigation, ↗ for a deeper detail page).
 *
 * Replaces the four-buttons-per-row clutter on Portfolio / AIQ Editor /
 * Decisions with pure Linear discipline.
 *
 * Three properties of a signature pattern:
 *   1. Reusable — works on Portfolio, AIQ Editor, Decisions, anywhere
 *      a table or list row exposes per-row actions.
 *   2. Recognizable — a user who's seen one row of quiet actions
 *      recognizes the pattern instantly on the next surface.
 *   3. Earned — the row stays calm at rest; the actions surface only
 *      when the user signals intent (hover) or arrives by keyboard
 *      (focus-within). Never both invisible and reachable.
 *
 * Usage:
 *   <tr className="row-hov">
 *     ...
 *     <td align="right">
 *       <QuietActions>
 *         <ActionPill href={`/edit/${id}`}>edit →</ActionPill>
 *         <ActionPill onClick={onSell} tone="danger">sell →</ActionPill>
 *         <ActionPill href={`/positions/${id}`}>detail ↗</ActionPill>
 *       </QuietActions>
 *     </td>
 *   </tr>
 *
 * The parent <tr> MUST carry className="row-hov" for the hover-reveal
 * to fire. The :focus-within escape hatch ensures keyboard tabbing
 * never traps focus on an invisible control.
 */

/**
 * Wrapper that turns the inside element into a quiet-actions zone. Use
 * inside a row cell where actions belong. Children are typically
 * <ActionPill> elements.
 *
 * Visibility is driven by global CSS: `.quiet-actions` is opacity 0
 * unless an ancestor `.row-hov` is hovered, an ancestor `.row-hov`
 * has :focus-within, or the .quiet-actions itself has :focus-within.
 */
export function QuietActions({ children }: { children: ReactNode }) {
  return <div className="quiet-actions">{children}</div>;
}

interface ActionPillProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  title?: string;
  tone?: "default" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
}

/**
 * Single action pill — borderless mono text glyph that reveals on row
 * hover via the surrounding .quiet-actions container. Renders as
 * either a <Link> (when `href` is provided) or a <button> (when only
 * `onClick` is provided). If both are provided, `href` wins.
 *
 * Pass the directional glyph inline within children:
 *   <ActionPill href={...}>edit →</ActionPill>
 *   <ActionPill href={...}>detail ↗</ActionPill>
 *
 * Tone variants:
 *   - "default"  text-3 → text-1 on hover (most actions)
 *   - "danger"   text-3 → danger on hover (sell, close, destructive)
 */
export function ActionPill({
  children,
  href,
  onClick,
  title,
  tone = "default",
  type = "button",
  disabled = false,
}: ActionPillProps) {
  const hoverColor = tone === "danger" ? "var(--danger)" : "var(--text-1)";

  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    height: 22,
    padding: "0 8px",
    fontFamily: "var(--m)",
    fontSize: 10.5,
    letterSpacing: ".04em",
    color: "var(--text-3)",
    background: "transparent",
    border: "none",
    borderRadius: 3,
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition:
      "color var(--dur-fast, 140ms) var(--ease-out, ease-out)",
    // expose hover color via custom prop so the :hover rule below can
    // pick it up without a stylesheet edit per consumer.
    ["--action-pill-hover" as string]: hoverColor,
  };

  // Inline :hover via onMouseEnter/Leave would defeat keyboard users.
  // We use a class hook + inline custom prop so a single global rule
  // could later attach if needed; for now, rely on CSS variable
  // interpolation in a style tag below the component is overkill —
  // instead, attach hover handlers that respect disabled state.
  // The pill itself is small enough that managed hover state is
  // negligible, but to keep keyboard parity we also apply the
  // hover color on :focus-visible via the same mechanism.

  if (href && !disabled) {
    return (
      <Link
        href={href}
        title={title}
        className="action-pill"
        style={baseStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = hoverColor;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.color = hoverColor;
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
        }}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="action-pill"
      style={baseStyle}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.color = hoverColor;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
      }}
      onFocus={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.color = hoverColor;
      }}
      onBlur={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
      }}
    >
      {children}
    </button>
  );
}

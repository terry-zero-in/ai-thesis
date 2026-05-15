/**
 * Status glyph — resolved §2.2 token mapping.
 * All glyphs share circle / rounded-square primitive language.
 *
 *   --status-pending  → dashed outline circle
 *   --status-active   → filled half-circle (progress)
 *   --status-blocked  → outline circle with horizontal bar
 *   --status-resolved → filled solid circle (check inside)
 *   --status-critical → filled red circle with !
 */
export type StatusKind =
  | "pending"
  | "queued"
  | "active"
  | "in-review"
  | "reviewing"
  | "blocked"
  | "resolved"
  | "greenlit"
  | "done"
  | "critical"
  | "escalated"
  | "needs-changes";

export function StatusGlyph({ kind, size = 12 }: { kind: StatusKind | string; size?: number }) {
  const s: React.CSSProperties = {
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
  if (kind === "critical")
    return (
      <span style={s}>
        <svg width={size} height={size} viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5" fill="var(--status-critical)" />
          <line x1="6" y1="3.4" x2="6" y2="6.6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="6" cy="8.6" r=".75" fill="#fff" />
        </svg>
      </span>
    );
  if (kind === "active" || kind === "in-review" || kind === "reviewing")
    return (
      <span style={s}>
        <svg width={size} height={size} viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5" fill="none" stroke="var(--status-active)" strokeWidth="1.5" />
          <path d="M6 1.5 A4.5 4.5 0 0 1 10.5 6 L6 6 Z" fill="var(--status-active)" />
        </svg>
      </span>
    );
  if (kind === "pending" || kind === "queued")
    return (
      <span style={s}>
        <svg width={size} height={size} viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5" fill="none" stroke="var(--status-pending)" strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      </span>
    );
  if (kind === "blocked")
    return (
      <span style={s}>
        <svg width={size} height={size} viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5" fill="none" stroke="var(--status-blocked)" strokeWidth="1.5" />
          <line x1="3" y1="6" x2="9" y2="6" stroke="var(--status-blocked)" strokeWidth="1.5" />
        </svg>
      </span>
    );
  if (kind === "resolved" || kind === "greenlit" || kind === "done")
    return (
      <span style={s}>
        <svg width={size} height={size} viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5" fill="var(--status-resolved)" />
          <polyline points="3.5,6.2 5.2,7.8 8.4,4.4" fill="none" stroke="var(--canvas)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  if (kind === "escalated")
    return (
      <span style={s}>
        <svg width={size} height={size} viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5" fill="none" stroke="var(--status-critical)" strokeWidth="1.5" />
          <path d="M6 3.4 V6.6" stroke="var(--status-critical)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="6" cy="8.4" r=".7" fill="var(--status-critical)" />
        </svg>
      </span>
    );
  if (kind === "needs-changes")
    return (
      <span style={s}>
        <svg width={size} height={size} viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5" fill="var(--warning)" />
          <line x1="6" y1="3.6" x2="6" y2="6.4" stroke="var(--canvas)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="6" cy="8.4" r=".7" fill="var(--canvas)" />
        </svg>
      </span>
    );
  return (
    <span style={s}>
      <svg width={size} height={size} viewBox="0 0 12 12">
        <circle cx="6" cy="6" r="5" fill="none" stroke="var(--text-3)" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

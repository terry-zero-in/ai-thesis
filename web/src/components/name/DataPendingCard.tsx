/**
 * Reusable placeholder card for detail-page sections that need data sources
 * we don't have ingestion for yet (insider Form 4, news, sentiment). Mirrors
 * the surrounding surface treatment so the page doesn't look broken.
 */
export function DataPendingCard({
  title,
  ticket,
  note,
  isFirst = false,
}: {
  title: string;
  ticket: string;
  note: string;
  isFirst?: boolean;
}) {
  return (
    // Mercury decard: ghost surface for unbuilt features. Vertical hairline
    // dividers when laid out in a row (page provides borderTop, cells get
    // borderLeft to make a strip).
    <div
      style={{
        padding: "16px 20px",
        borderLeft: isFirst ? undefined : "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--m)",
            color: "var(--text-4)",
            background: "rgba(255,255,255,.03)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "1px 5px",
          }}
        >
          {ticket}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}

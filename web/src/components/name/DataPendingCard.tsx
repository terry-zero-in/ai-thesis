/**
 * Placeholder card for detail-page surfaces that need a data source not
 * yet wired (news, sentiment timeline). Renders as a quiet anchor —
 * "this is where X lives" — not as a "this is unfinished" advertisement.
 * Ticket-ID pill removed per /lambo "stop apologizing for being early."
 */
export function DataPendingCard({
  title,
  note,
  isFirst = false,
}: {
  title: string;
  note: string;
  isFirst?: boolean;
}) {
  return (
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
      <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}

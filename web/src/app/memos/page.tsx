import { getMemosSnapshot } from "@/lib/memos-data";
import { MemoCard } from "./MemoCard";
import { NoRail } from "@/components/shell/NoRail";

/**
 * Revalidate hourly. Daily memo lands at 13:00 UTC; weekly memo at
 * Sunday evening. 1-hour ISR keeps the page fresh without forcing a
 * hard refresh.
 */
export const revalidate = 3600;

export default async function MemosPage() {
  const snap = await getMemosSnapshot();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NoRail />
      <header
        style={{
          padding: "18px 28px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-.014em",
            color: "var(--text-1)",
            fontFamily: "var(--m)",
          }}
        >
          Memos
        </h1>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          Daily 8am CT · Weekly Sun PM · {snap.rows.length} most recent
          {snap.synthetic ? " · fixture mode" : ""}
        </span>
      </header>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {snap.rows.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-3)", paddingTop: 24 }}>
            No memos yet. The daily cron fires Mon-Fri at 13:00 UTC.
          </div>
        ) : (
          snap.rows.map((m) => <MemoCard key={m.id} memo={m} />)
        )}
      </div>
    </div>
  );
}

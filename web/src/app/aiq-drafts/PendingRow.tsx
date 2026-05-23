import type { QueueRow } from "@/lib/aiq-queue";

const REASON_LABELS: Record<QueueRow["reason"], string> = {
  new_universe: "New universe addition",
  drift: "Drift threshold tripped",
  stale: "Stale (>30d)",
  manual: "Manual request",
};

/**
 * PendingRow — thin one-line render for a queued AIQ draft. Reads from
 * public.aiq_draft_queue (status='queued'). The daily-batch Routine
 * flips status as it works the queue.
 */
export function PendingRow({ row }: { row: QueueRow }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 14,
        padding: "10px 14px",
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        background: "var(--surface-1)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-1)",
          minWidth: 56,
        }}
      >
        {row.ticker}
      </span>
      <span style={{ fontSize: 12, color: "var(--text-2)", flex: 1 }}>
        {REASON_LABELS[row.reason] ?? row.reason}
      </span>
      <span
        style={{
          fontSize: 11,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          letterSpacing: ".04em",
        }}
        title={row.requested_at}
      >
        {formatRelative(row.requested_at)}
      </span>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso;
  const deltaSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

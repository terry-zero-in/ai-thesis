import { getAiqDraftsSnapshot } from "@/lib/aiq-drafts-data";
import { getQueuedAiqDrafts } from "@/lib/aiq-queue";
import { DraftCard } from "./DraftCard";
import { PendingRow } from "./PendingRow";
import { TabbedDrafts } from "./TabbedDrafts";
import { NoRail } from "@/components/shell/NoRail";
import { PageHeader } from "@/components/primitives/PageHeader";

/**
 * Revalidate every 15 minutes. Drafts trickle in as the per-ticker
 * generate-aiq-draft function gets invoked; no need for live updates.
 */
export const revalidate = 900;

export default async function AiqDraftsPage() {
  const [snap, queued] = await Promise.all([
    getAiqDraftsSnapshot(),
    getQueuedAiqDrafts(),
  ]);
  const unreviewed = snap.rows.filter((r) => r.approved_at === null);
  const reviewed = snap.rows.filter((r) => r.approved_at !== null);

  const emptyDim: React.CSSProperties = {
    fontSize: 13,
    color: "var(--text-3)",
    paddingTop: 24,
  };

  const pendingPanel =
    queued.length === 0 ? (
      <div style={emptyDim}>
        No tickers queued. Drift detection + monthly curator add to this queue.
      </div>
    ) : (
      queued.map((q) => <PendingRow key={q.id} row={q} />)
    );

  const unreviewedPanel =
    unreviewed.length === 0 ? (
      <div style={emptyDim}>
        No drafts yet. Invoke <code>generate-aiq-draft</code> per ticker
        (see <code>docs/aiq-drafts-pipeline.md</code>) to seed this page.
      </div>
    ) : (
      unreviewed.map((d) => <DraftCard key={d.id} draft={d} />)
    );

  const reviewedPanel =
    reviewed.length === 0 ? (
      <div style={{ fontSize: 12, color: "var(--text-4)", paddingTop: 24 }}>
        No reviewed drafts yet.
      </div>
    ) : (
      reviewed.map((d) => <DraftCard key={d.id} draft={d} />)
    );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NoRail />
      <PageHeader
        title="AIQ Drafts"
        subtitle={`${queued.length} pending · ${unreviewed.length} unreviewed · ${reviewed.length} reviewed`}
      />

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 28px 24px",
        }}
      >
        <TabbedDrafts
          counts={{
            pending: queued.length,
            unreviewed: unreviewed.length,
            reviewed: reviewed.length,
          }}
          pending={pendingPanel}
          unreviewed={unreviewedPanel}
          reviewed={reviewedPanel}
        />
      </div>
    </div>
  );
}

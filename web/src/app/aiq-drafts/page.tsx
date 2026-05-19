import { getAiqDraftsSnapshot } from "@/lib/aiq-drafts-data";
import { DraftCard } from "./DraftCard";
import { NoRail } from "@/components/shell/NoRail";
import { PageHeader } from "@/components/primitives/PageHeader";

/**
 * Revalidate every 15 minutes. Drafts trickle in as the per-ticker
 * generate-aiq-draft function gets invoked; no need for live updates.
 */
export const revalidate = 900;

export default async function AiqDraftsPage() {
  const snap = await getAiqDraftsSnapshot();
  const unreviewed = snap.rows.filter((r) => r.approved_at === null);
  const reviewed = snap.rows.filter((r) => r.approved_at !== null);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NoRail />
      <PageHeader
        title="AIQ Drafts"
        subtitle={`${unreviewed.length} pending · ${reviewed.length} reviewed`}
      />

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {snap.rows.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-3)", paddingTop: 24 }}>
            No drafts yet. Invoke <code>generate-aiq-draft</code> per ticker
            (see <code>docs/aiq-drafts-pipeline.md</code>) to seed this page.
          </div>
        ) : (
          snap.rows.map((d) => <DraftCard key={d.id} draft={d} />)
        )}
      </div>
    </div>
  );
}

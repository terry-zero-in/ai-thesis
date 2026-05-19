import { getUniverseProposals } from "@/lib/routine-outputs";
import { PageHeader } from "@/components/primitives/PageHeader";

/**
 * Universe proposals — written by the monthly-curator Routine (PR1, E80).
 *
 * Renders pending ADD/TRIM proposals for review. Empty state explains
 * the cadence so the page doesn't read as "broken" before the first
 * routine fire.
 *
 * Future (deferred to follow-up): approve/dismiss actions write to
 * universe table (adds), close existing universe rows (trims), and
 * mark proposal status='partially_accepted'|'accepted'|'dismissed'.
 */
export const revalidate = 600;

export default async function ProposalsPage() {
  const proposals = await getUniverseProposals();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", minWidth: 0 }}>
      <PageHeader
        title="Universe proposals"
        subtitle="Monthly curator suggestions for the 50-name universe"
        meta={[
          { label: "pending", value: proposals.length },
          { label: "engine", value: "monthly-curator routine" },
          { label: "cadence", value: "first Saturday of month, 20:00 UTC" },
        ]}
      />

      <div style={{ padding: "20px 24px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
        {proposals.length === 0 ? (
          <EmptyState />
        ) : (
          proposals.map((p, i) => (
            <div
              key={p.id}
              className="row-stagger-in"
              style={{ animationDelay: `${Math.min(i * 50, 600)}ms` }}
            >
              <ProposalCard proposal={p} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------- components ---------------- */

function EmptyState() {
  return (
    <div
      style={{
        border: "1px dashed var(--border-subtle)",
        borderRadius: 6,
        padding: "32px 24px",
        textAlign: "center",
        color: "var(--text-3)",
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <p style={{ margin: 0, color: "var(--text-2)", fontWeight: 500 }}>No pending proposals.</p>
      <p style={{ margin: "6px 0 0", fontSize: 12 }}>
        The monthly-curator routine fires on the first Saturday of each month and writes ADD/TRIM
        suggestions here. Until the first fire, this page stays empty.
      </p>
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: Awaited<ReturnType<typeof getUniverseProposals>>[number] }) {
  return (
    <article
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-1)",
            fontFamily: "var(--m)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {proposal.month_of}
        </span>
        <span style={{ fontSize: 11, fontFamily: "var(--m)", color: "var(--text-3)" }}>
          {proposal.adds.length} adds · {proposal.trims.length} trims
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--warning)",
            background: "var(--warning-soft)",
            border: "1px solid rgba(221,168,90,.30)",
            padding: "1px 7px",
            borderRadius: 3,
            letterSpacing: ".04em",
            textTransform: "uppercase",
          }}
        >
          Pending review
        </span>
      </header>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
          {proposal.reasoning}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <ProposalList label="ADD" color="var(--success)" items={proposal.adds.map((a) => ({ ticker: a.ticker, sub: a.name, note: a.reason }))} />
          <ProposalList label="TRIM" color="var(--danger)" items={proposal.trims.map((t) => ({ ticker: t.ticker, sub: "", note: t.reason }))} />
        </div>
      </div>

      <footer
        style={{
          padding: "10px 18px",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: 11,
          fontFamily: "var(--m)",
          color: "var(--text-4)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        proposed {new Date(proposal.created_at).toISOString().slice(0, 10)} · approve actions ship in follow-up
      </footer>
    </article>
  );
}

function ProposalList({
  label,
  color,
  items,
}: {
  label: string;
  color: string;
  items: Array<{ ticker: string; sub: string; note: string }>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 10.5,
          fontFamily: "var(--m)",
          color,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label} ({items.length})
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-4)", fontStyle: "italic" }}>none</div>
      ) : (
        items.map((it) => (
          <div
            key={it.ticker}
            style={{
              border: "1px solid var(--border-subtle)",
              borderRadius: 5,
              padding: "8px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--m)", fontWeight: 600, color: "var(--text-1)" }}>{it.ticker}</span>
              {it.sub && (
                <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{it.sub}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{it.note}</div>
          </div>
        ))
      )}
    </div>
  );
}

import { getAlertsSnapshot } from "@/lib/alerts-data";
import { AlertRow } from "./AlertRow";
import { ALERT_KIND_LABELS } from "@/lib/alerts-types";
import { NoRail } from "@/components/shell/NoRail";

/**
 * Revalidate every 10 minutes so newly-derived alerts (from
 * scores_history + macro_gauges) surface without hard refresh. Each ack
 * action also revalidates this path + the root layout (sidebar badge).
 */
export const revalidate = 600;

export default async function DecisionsPage() {
  const snap = await getAlertsSnapshot();

  // Group by kind for the rail summary; events array stays time-sorted.
  const byKind: Record<string, number> = {};
  for (const e of snap.events) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

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
          Decisions
        </h1>
        <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
          Tier movement log + alerts · {snap.events.length} event
          {snap.events.length === 1 ? "" : "s"} ·{" "}
          <strong style={{ color: snap.unseen > 0 ? "var(--danger)" : "var(--text-3)" }}>
            {snap.unseen} unseen
          </strong>
        </span>
        <div style={{ flex: 1 }} />
        {snap.synthetic && (
          <span
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--text-3)",
              border: "1px dashed var(--border)",
              padding: "2px 8px",
              borderRadius: 3,
            }}
          >
            fixture
          </span>
        )}
      </header>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 28px 32px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 260px",
          gap: 18,
          alignItems: "start",
        }}
      >
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {snap.events.length === 0 ? (
            <div
              style={{
                padding: "32px 18px",
                fontSize: 13,
                color: "var(--text-3)",
                textAlign: "center",
              }}
            >
              No events yet. Tier transitions and macro flips will land here as
              the Saturday composite cron writes new scores_history rows.
            </div>
          ) : (
            snap.events.map((e) => <AlertRow key={e.key} event={e} />)
          )}
        </section>

        <aside
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            position: "sticky",
            top: 0,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              color: "var(--text-3)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              paddingBottom: 8,
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            By kind
          </div>
          {(Object.keys(ALERT_KIND_LABELS) as (keyof typeof ALERT_KIND_LABELS)[]).map((k) => {
            const n = byKind[k] ?? 0;
            return (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: n > 0 ? "var(--text-1)" : "var(--text-3)",
                }}
              >
                <span>{ALERT_KIND_LABELS[k]}</span>
                <span
                  style={{
                    fontFamily: "var(--m)",
                    fontVariantNumeric: "tabular-nums",
                    color: n > 0 ? "var(--text-1)" : "var(--text-4)",
                  }}
                >
                  {n}
                </span>
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 10.5,
              color: "var(--text-3)",
              lineHeight: 1.6,
              paddingTop: 8,
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            Quarterly review fires Feb / May / Aug / Nov on day 5. Insider
            cluster alerts derive from Form 4 ingestion (THS-61) and fire on
            BUY / SELL clusters newly qualifying within the past 4 weeks.
          </div>
        </aside>
      </div>
    </div>
  );
}

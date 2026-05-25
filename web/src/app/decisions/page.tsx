import Link from "next/link";
import { getAlertsSnapshot } from "@/lib/alerts-data";
import { AlertRow } from "./AlertRow";
import { BulkAckButton } from "./BulkAckButton";
import { ALERT_KIND_LABELS, type AlertKind } from "@/lib/alerts-types";
import { NoRail } from "@/components/shell/NoRail";
import { PageHeader } from "@/components/primitives/PageHeader";
import { EngineStatusStripAsync } from "@/components/primitives/EngineStatusStripAsync";

/**
 * Revalidate every 10 minutes so newly-derived alerts (from
 * scores_history + macro_gauges) surface without hard refresh. Each ack
 * action also revalidates this path + the root layout (sidebar badge).
 */
export const revalidate = 600;

function isAlertKind(v: string | undefined): v is AlertKind {
  return v != null && v in ALERT_KIND_LABELS;
}

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const snap = await getAlertsSnapshot();
  const params = await searchParams;
  const activeKind: AlertKind | null = isAlertKind(params.kind) ? params.kind : null;

  // Group by kind (over the FULL event set, before filtering) so the
  // counts in the BY KIND panel show inventory, not "what survived the
  // filter you just applied."
  const byKind: Record<string, number> = {};
  for (const e of snap.events) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

  const visibleEvents = activeKind == null ? snap.events : snap.events.filter((e) => e.kind === activeKind);
  // Review §2.10 #5 — bulk-ack covers unseen events in the CURRENT view
  // (respects the active kind filter, so "Mark 4 read" only acks the
  // tier_change set when filtering to that kind).
  const unseenKeysInView = visibleEvents.filter((e) => !e.acked_at).map((e) => e.key);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NoRail />
      <PageHeader
        title="Decisions"
        subtitle={
          <span>
            Tier movement log + alerts ·{" "}
            <strong style={{ color: snap.unseen > 0 ? "var(--danger)" : "var(--text-3)" }}>
              {snap.unseen} unseen
            </strong>
          </span>
        }
        action={
          <BulkAckButton
            keys={unseenKeysInView}
            label={activeKind ? `Mark ${unseenKeysInView.length} read` : `Mark all read`}
          />
        }
        meta={[
          { label: "events", value: snap.events.length },
          { label: "kinds", value: Object.keys(byKind).length },
          { label: "engine", value: "alerts v1.0" },
          {
            label: "mode",
            value: (
              <span
                style={{
                  color: snap.synthetic ? "var(--warning)" : "var(--success)",
                  fontWeight: 600,
                  letterSpacing: ".02em",
                }}
                title={
                  snap.synthetic
                    ? "Sample data — alerts derived from the sample universe + macro state."
                    : "Live data — alerts derived from your account's latest scores + macro gauges."
                }
              >
                {snap.synthetic ? "Sample" : "Live"}
              </span>
            ),
          },
        ]}
      />
      <EngineStatusStripAsync />
      {activeKind && (
        <div style={{ padding: "10px 32px 0", flexShrink: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--m)",
                color: "var(--accent)",
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
                padding: "2px 8px",
                borderRadius: 3,
                letterSpacing: ".04em",
              }}
            >
              {ALERT_KIND_LABELS[activeKind]} · {visibleEvents.length}
            </span>
            <Link
              href="/decisions"
              style={{
                fontSize: 11,
                fontFamily: "var(--m)",
                color: "var(--text-3)",
                textDecoration: "none",
                border: "1px solid var(--border)",
                padding: "2px 8px",
                borderRadius: 3,
                letterSpacing: ".04em",
                textTransform: "uppercase",
              }}
            >
              Clear
            </Link>
          </span>
        </div>
      )}

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
          ) : visibleEvents.length === 0 ? (
            <div
              style={{
                padding: "32px 18px",
                fontSize: 13,
                color: "var(--text-3)",
                textAlign: "center",
              }}
            >
              No {activeKind ? ALERT_KIND_LABELS[activeKind].toLowerCase() : ""} events.{" "}
              <Link href="/decisions" style={{ color: "var(--accent)" }}>
                Clear filter
              </Link>
              .
            </div>
          ) : (
            visibleEvents.map((e, i) => (
              <div
                key={e.key}
                className="row-stagger-in"
                style={{ animationDelay: `${Math.min(i * 30, 1000)}ms` }}
              >
                <AlertRow event={e} />
              </div>
            ))
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
            const active = activeKind === k;
            const clickable = n > 0;
            const href = active ? "/decisions" : `/decisions?kind=${k}`;
            const content = (
              <>
                <span style={{ flex: 1, minWidth: 0 }}>{ALERT_KIND_LABELS[k]}</span>
                <span
                  style={{
                    fontFamily: "var(--m)",
                    fontVariantNumeric: "tabular-nums",
                    color: active ? "var(--accent)" : n > 0 ? "var(--text-1)" : "var(--text-4)",
                  }}
                >
                  {n}
                </span>
              </>
            );
            const baseStyle: React.CSSProperties = {
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 6px",
              margin: "0 -6px",
              borderRadius: 3,
              fontSize: 12,
              color: active ? "var(--accent)" : n > 0 ? "var(--text-1)" : "var(--text-3)",
              background: active ? "var(--accent-soft)" : "transparent",
              border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
              textDecoration: "none",
              fontFamily: "var(--f)",
              cursor: clickable ? "pointer" : "default",
            };
            if (!clickable) {
              return (
                <div key={k} style={baseStyle}>
                  {content}
                </div>
              );
            }
            return (
              <Link
                key={k}
                href={href}
                className="lin-hov"
                style={baseStyle}
                aria-pressed={active}
              >
                {content}
              </Link>
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

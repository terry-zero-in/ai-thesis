import Link from "next/link";
import { getAiqIndex } from "@/lib/aiq-data";
import { NoRail } from "@/components/shell/NoRail";
import { PageHeader } from "@/components/primitives/PageHeader";
import { EngineStatusStripAsync } from "@/components/primitives/EngineStatusStripAsync";
import { LayerChip } from "@/components/universe/LayerChip";

type ShowFilter = "scored" | "unscored" | "all";
const SHOW_FILTERS: { key: ShowFilter; label: string }[] = [
  { key: "scored", label: "Scored" },
  { key: "unscored", label: "Unscored" },
  { key: "all", label: "All" },
];

/**
 * Revalidate every 30 min. AIQ rubric changes are operator-edited
 * via /aiq/[ticker] or promoted from /aiq-drafts; no cron updates.
 */
export const revalidate = 1800;

const DIM_COLS: Array<{ key: keyof import("@/lib/aiq-data").AiqIndexRow; label: string; cap: number }> = [
  { key: "disclosure_pts",    label: "Disc", cap: 20 },
  { key: "defensibility_pts", label: "Defens", cap: 20 },
  { key: "concentration_pts", label: "Conc", cap: 15 },
  { key: "capex_eff_pts",     label: "Capex", cap: 15 },
  { key: "indep_demand_pts",  label: "Indep", cap: 15 },
  { key: "accounting_pts",    label: "Acct", cap: 15 },
];

function isShowFilter(v: string | undefined): v is ShowFilter {
  return v === "scored" || v === "unscored" || v === "all";
}

export default async function AiqIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const snap = await getAiqIndex();
  const params = await searchParams;
  const show: ShowFilter = isShowFilter(params.show) ? params.show : "scored";
  const filtered = snap.rows.filter((r) => {
    if (show === "all") return true;
    if (show === "scored") return r.total != null;
    return r.total == null;
  });
  const rowsSorted = [...filtered].sort((a, b) => {
    if (a.total == null && b.total == null) return a.ticker.localeCompare(b.ticker);
    if (a.total == null) return 1;
    if (b.total == null) return -1;
    return b.total - a.total;
  });
  const unscoredCount = snap.rows.length - snap.scoredCount;
  // Quarterly cadence — surface the next rescore date so "manual · quarterly"
  // isn't an open-ended commitment. Derived from snap.asOf + 90d (median
  // calendar quarter; not exactly +1 calendar quarter but close enough for
  // operator planning, and avoids leap-year edge cases). Null when nothing
  // has been scored yet.
  const nextRescore = snap.asOf
    ? new Date(new Date(snap.asOf).getTime() + 90 * 86_400_000).toISOString().slice(0, 10)
    : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NoRail />
      <PageHeader
        title="AIQ Editor"
        action={
          <Link
            href="/aiq-drafts"
            style={{
              fontSize: 11,
              fontFamily: "var(--m)",
              color: "var(--accent)",
              textDecoration: "none",
              padding: "4px 10px",
              border: "1px solid var(--accent-border)",
              borderRadius: 3,
              letterSpacing: ".04em",
              textTransform: "uppercase",
            }}
          >
            Drafts queue ›
          </Link>
        }
        meta={[
          { label: "scored", value: `${snap.scoredCount}/${snap.rows.length}` },
          { label: "as_of", value: snap.asOf ?? "—" },
          { label: "cadence", value: "manual · quarterly" },
          ...(nextRescore ? [{ label: "next rescore", value: nextRescore }] : []),
        ]}
      />
      <EngineStatusStripAsync />
      <div style={{ padding: "10px 32px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }} />
          <div style={{ display: "inline-flex", gap: 0, border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            {SHOW_FILTERS.map((f, i) => {
              const active = f.key === show;
              const count =
                f.key === "scored" ? snap.scoredCount :
                f.key === "unscored" ? unscoredCount :
                snap.rows.length;
              return (
                <Link
                  key={f.key}
                  href={f.key === "scored" ? "/aiq" : `/aiq?show=${f.key}`}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontFamily: "var(--m)",
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    background: active ? "var(--hover-tint)" : "transparent",
                    color: active ? "var(--text-1)" : "var(--text-3)",
                    borderLeft: i === 0 ? undefined : "1px solid var(--border)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {f.label} <span style={{ color: active ? "var(--text-2)" : "var(--text-4)" }}>{count}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12.5,
            fontFamily: "var(--m)",
          }}
        >
          <thead
            style={{
              position: "sticky",
              top: 0,
              background: "var(--canvas)",
              zIndex: 1,
            }}
          >
            <tr>
              <Th>Ticker</Th>
              <Th align="left">Name</Th>
              <Th>Layer</Th>
              <Th>Total</Th>
              {DIM_COLS.map((d) => (
                <Th key={d.key}>{d.label}</Th>
              ))}
              <Th>Scored</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rowsSorted.map((r, i) => (
              <tr
                key={r.ticker}
                className="row-hov row-stagger-in"
                title={
                  r.total == null
                    ? `${r.ticker} — not yet scored. Click to open the editor.`
                    : `${r.ticker} — last scored ${r.scored_at ?? "—"} (${r.total}/100). Click to edit.`
                }
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  background: r.total == null ? "rgba(251, 113, 133, .03)" : undefined,
                  animationDelay: `${Math.min(i * 25, 1200)}ms`,
                }}
              >
                <Td>
                  <Link
                    href={`/aiq/${r.ticker}`}
                    style={{ color: "var(--text-1)", textDecoration: "none", fontWeight: 600 }}
                  >
                    {r.ticker}
                  </Link>
                </Td>
                <Td align="left" muted>{r.name}</Td>
                <Td align="left" muted>
                  <LayerChip layer={r.layer} label={r.layer_label} />
                </Td>
                <Td>
                  {r.total == null ? (
                    <span style={{ color: "var(--danger)" }}>—</span>
                  ) : (
                    <span style={{ color: totalColor(r.total) }}>{r.total}</span>
                  )}
                </Td>
                {DIM_COLS.map((d) => (
                  <Td key={d.key} muted>
                    {r[d.key] == null ? "—" : `${r[d.key]}/${d.cap}`}
                  </Td>
                ))}
                <Td muted>{r.scored_at ?? "—"}</Td>
                <Td>
                  <Link
                    href={`/aiq/${r.ticker}`}
                    style={{
                      color: "var(--accent)",
                      textDecoration: "none",
                      fontSize: 11,
                    }}
                  >
                    Edit ›
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function totalColor(total: number): string {
  if (total >= 80) return "var(--success)";
  if (total >= 60) return "var(--text-1)";
  if (total >= 40) return "var(--warning)";
  return "var(--danger)";
}

function Th({ children, align = "right" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 12px",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: ".08em",
        color: "var(--text-3)",
        fontWeight: 500,
        borderBottom: "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "right", muted = false }: { children?: React.ReactNode; align?: "left" | "right"; muted?: boolean }) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "8px 12px",
        color: muted ? "var(--text-2)" : "var(--text-1)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

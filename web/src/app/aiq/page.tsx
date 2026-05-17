import Link from "next/link";
import { getAiqIndex } from "@/lib/aiq-data";
import { NoRail } from "@/components/shell/NoRail";

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

export default async function AiqIndexPage() {
  const snap = await getAiqIndex();
  const rowsSorted = [...snap.rows].sort((a, b) => {
    if (a.total == null && b.total == null) return a.ticker.localeCompare(b.ticker);
    if (a.total == null) return 1;
    if (b.total == null) return -1;
    return b.total - a.total;
  });

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
          AIQ Editor
        </h1>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          {snap.scoredCount} / {snap.rows.length} scored
          {snap.asOf ? ` · latest ${snap.asOf}` : ""}
          {snap.synthetic ? " · fixture mode" : ""}
        </span>
        <div style={{ flex: 1 }} />
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
          Drafts queue ↗
        </Link>
      </header>

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
            {rowsSorted.map((r) => (
              <tr
                key={r.ticker}
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  background: r.total == null ? "rgba(251, 113, 133, .03)" : undefined,
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
                <Td muted>{r.layer_label}</Td>
                <Td>
                  {r.total == null ? (
                    <span style={{ color: "#FB7185" }}>—</span>
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
                    edit ↗
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
  if (total >= 80) return "#86EFAC";
  if (total >= 60) return "var(--text-1)";
  if (total >= 40) return "#FBBF24";
  return "#FB7185";
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

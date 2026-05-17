/**
 * Q / G / V / AIQ factor panels. Each shows the headline 0-100 score plus
 * the sub-component decomposition from `scores_history.factor_breakdown`:
 *   - Q: 4 pillars (profitability, growth, safety, payout) — composite_z each
 *   - G: 3 signals (NTM growth, AI-segment growth, capex efficiency) — raw
 *   - V: 3 signals (PEG-like, adj FCF yield, own forward-P/E z) — raw +
 *        v_penalty if any
 *   - AIQ: total of the 6 rubric dims (delegated to AiqRubric component)
 */
import Link from "next/link";
import type { NameDetail } from "@/lib/name-detail-data";

export function FactorPanels({ d }: { d: NameDetail }) {
  // Mercury KPI strip (Pic 17 b2): 4 cells with vertical hairline dividers,
  // top + bottom hairlines on the strip, no outer card chrome. Each cell
  // shows the factor label, score, progress bar, and pillar decomposition.
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <Panel title="Q · Quality" score={d.q_score} accent="var(--accent)" isFirst>
        {d.q ? (
          <PillarList
            rows={[
              ["Profitability", d.q.pillars.profitability],
              ["Growth", d.q.pillars.growth],
              ["Safety", d.q.pillars.safety],
              ["Payout", d.q.pillars.payout],
            ]}
            zStyle
          />
        ) : (
          <Empty />
        )}
      </Panel>
      <Panel title="G · Growth" score={d.g_score} accent="var(--success)">
        {d.g ? (
          <PillarList
            rows={[
              ["NTM Growth", fmtPct(d.g.signals.ntmGrowth)],
              ["AI Segment", fmtPct(d.g.signals.aiSegment)],
              ["Capex Efficiency", fmtNum(d.g.signals.capexEfficiency)],
            ]}
          />
        ) : (
          <Empty />
        )}
      </Panel>
      <Panel title="V · Value" score={d.v_score} accent="var(--warning)">
        {d.v ? (
          <>
            <PillarList
              rows={[
                ["PEG-like", fmtNum(d.v.signals.pegLike)],
                ["FCF Yield", fmtPct(d.v.signals.adjFcfYield)],
                ["Own Fwd-PE z", fmtZ(d.v.signals.ownHistoryFwdPeZ)],
                ["Fwd-PE Mean", fmtNum(d.v.signals.forwardPeMean)],
              ]}
            />
            {d.v.penalty < 0 && (
              <div
                style={{
                  marginTop: 10,
                  padding: "6px 8px",
                  background: "rgba(251,113,133,.06)",
                  border: "1px solid rgba(251,113,133,.25)",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "var(--danger)",
                  fontFamily: "var(--m)",
                }}
              >
                Penalty {d.v.penalty} (depreciation flag)
              </div>
            )}
          </>
        ) : (
          <Empty />
        )}
      </Panel>
      <Panel
        title="AIQ"
        score={d.aiq_score}
        accent="var(--info)"
        action={
          <Link
            href={`/aiq/${d.ticker}`}
            className="lin-hov"
            style={{
              fontSize: 10,
              fontFamily: "var(--m)",
              color: "var(--text-3)",
              textDecoration: "none",
              padding: "2px 7px",
              border: "1px solid var(--border)",
              borderRadius: 3,
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            Edit
          </Link>
        }
      >
        {d.aiq_rubric ? (
          <PillarList
            rows={[
              ["Disclosure", d.aiq_rubric.disclosure_pts, 20],
              ["Defensibility", d.aiq_rubric.defensibility_pts, 20],
              ["Concentration", d.aiq_rubric.concentration_pts, 15],
              ["Capex Eff.", d.aiq_rubric.capex_eff_pts, 15],
              ["Indep. Demand", d.aiq_rubric.indep_demand_pts, 15],
              ["Accounting", d.aiq_rubric.accounting_pts, 15],
            ]}
            ptsStyle
          />
        ) : (
          <Empty hint="No rubric scored yet — open the editor to add the first scoring." />
        )}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  score,
  accent,
  action,
  children,
  isFirst = false,
}: {
  title: string;
  score: number | null;
  accent: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div
      style={{
        padding: "16px 20px",
        borderLeft: isFirst ? undefined : "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            flex: 1,
            minWidth: 0,
          }}
        >
          {title}
        </span>
        {action}
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 18,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: score == null ? "var(--text-4)" : "var(--text-1)",
            lineHeight: 1,
          }}
        >
          {score == null ? "—" : score.toFixed(1)}
        </span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,.04)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: accent, opacity: 0.85 }} />
      </div>
      {children}
    </div>
  );
}

function PillarList({
  rows,
  zStyle,
  ptsStyle,
}: {
  rows: (readonly [string, string | number | null] | readonly [string, number | null, number])[];
  zStyle?: boolean;
  ptsStyle?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((row) => {
        const [label, value] = row;
        const cap = row.length === 3 ? (row as [string, number | null, number])[2] : null;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ color: "var(--text-3)", flex: 1, minWidth: 0 }}>{label}</span>
            {/* Review §2.3 #6: spec format is "18 / 20" (value first). Render
                value, then "/ {cap}" — was "/ 20 18" before. */}
            <span
              style={{
                fontFamily: "var(--m)",
                fontSize: 11.5,
                color:
                  value == null
                    ? "var(--text-4)"
                    : zStyle
                    ? (value as number) > 0
                      ? "var(--success)"
                      : (value as number) < 0
                      ? "var(--danger)"
                      : "var(--text-2)"
                    : "var(--text-2)",
                fontVariantNumeric: "tabular-nums",
                minWidth: 44,
                textAlign: "right",
              }}
            >
              {value == null ? "—" : typeof value === "number" ? (zStyle ? formatSigned(value) : value.toString()) : value}
            </span>
            {ptsStyle && cap != null && (
              <span style={{ fontFamily: "var(--m)", fontSize: 11, color: "var(--text-3)" }}>
                / {cap}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Empty({ hint }: { hint?: string } = {}) {
  return (
    <div style={{ fontSize: 11, color: "var(--text-4)", fontStyle: "italic" }}>
      {hint ?? "Score available; sub-decomposition pending next compute run."}
    </div>
  );
}

function fmtPct(v: number | null): string | null {
  if (v == null) return null;
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number | null): string | null {
  if (v == null) return null;
  return v.toFixed(2);
}

function fmtZ(v: number | null): number | null {
  return v;
}

function formatSigned(v: number): string {
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(2)}`;
}

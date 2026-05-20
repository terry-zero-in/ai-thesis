import Link from "next/link";
import type { MorningBrief as MorningBriefData } from "@/lib/routine-outputs";

/**
 * MorningBrief — dashboard section surfacing the daily-batch routine
 * outputs (PR1, E80). Shows the most-recent insider digest + macro
 * interpretation + pending memo proposals.
 *
 * Empty state: returns null (no chrome) when none of the three are
 * populated. The dashboard already has score-movers + macro gate strip
 * carrying the page; this section is additive, not load-bearing.
 *
 * /lambo: pre-Routines-firing, this surface is invisible. Once the
 * daily-batch starts producing data, it appears overnight.
 */
export function MorningBrief({ data }: { data: MorningBriefData }) {
  const { insider, macro, pendingMemoProposals, asOf } = data;
  const hasAnything = insider != null || macro != null || pendingMemoProposals.length > 0;
  if (!hasAnything) return null;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          paddingBottom: 10,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            color: "var(--text-3)",
            fontFamily: "var(--m)",
          }}
        >
          Morning brief
        </div>
        {asOf && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-4)",
              fontFamily: "var(--m)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            as_of {asOf}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 1,
          background: "var(--border-subtle)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {macro && <MacroPanel macro={macro} />}
        {insider && <InsiderPanel insider={insider} />}
        {pendingMemoProposals.length > 0 && <MemoProposalsPanel proposals={pendingMemoProposals} />}
      </div>
    </section>
  );
}

/* ---------------- panels ---------------- */

function MacroPanel({ macro }: { macro: NonNullable<MorningBriefData["macro"]> }) {
  const stateColor =
    macro.regime_state === "neutral"
      ? "var(--success)"
      : macro.regime_state === "defensive"
        ? "var(--danger)"
        : "var(--warning)";
  return (
    <PanelShell label="Macro" right={<RegimePill label={macro.regime_state} color={stateColor} multiplier={macro.multiplier} />}>
      <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, margin: 0 }}>
        {macro.narrative}
      </p>
      {macro.delta_summary && (
        <p
          style={{
            fontSize: 11,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            lineHeight: 1.5,
            margin: 0,
            paddingTop: 6,
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          {macro.delta_summary}
        </p>
      )}
    </PanelShell>
  );
}

function InsiderPanel({ insider }: { insider: NonNullable<MorningBriefData["insider"]> }) {
  return (
    <PanelShell
      label="Insider · last 24h"
      right={
        <span style={{ fontSize: 11, fontFamily: "var(--m)", color: "var(--text-3)" }}>
          <span style={{ color: "var(--success)" }}>{insider.buy_count} buy</span>
          {" · "}
          <span style={{ color: "var(--danger)" }}>{insider.sell_count} sell</span>
        </span>
      }
    >
      <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, margin: 0 }}>
        {insider.summary}
      </p>
      {insider.flagged_tickers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingTop: 6 }}>
          {insider.flagged_tickers.map((t) => (
            <Link
              key={t}
              href={`/universe/${t}`}
              style={{
                fontSize: 10.5,
                fontFamily: "var(--m)",
                color: "var(--text-2)",
                background: "rgba(139,92,246,.08)",
                border: "1px solid rgba(139,92,246,.30)",
                padding: "1px 6px",
                borderRadius: 3,
                textDecoration: "none",
                letterSpacing: ".02em",
              }}
            >
              {t}
            </Link>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function MemoProposalsPanel({ proposals }: { proposals: NonNullable<MorningBriefData["pendingMemoProposals"]> }) {
  return (
    <PanelShell
      label="Memo proposals"
      right={
        <Link
          href="/memos"
          style={{ fontSize: 11, fontFamily: "var(--m)", color: "var(--accent)", textDecoration: "none" }}
        >
          Review all ›
        </Link>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {proposals.slice(0, 3).map((p) => (
          <div
            key={p.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 10,
              alignItems: "baseline",
              fontSize: 12,
              fontFamily: "var(--m)",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{p.ticker}</span>
            <span
              style={{
                color: "var(--text-3)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "var(--f)",
                fontSize: 12.5,
              }}
            >
              {p.suggested_memo}
            </span>
            <span
              style={{
                color: p.drift_delta > 0 ? "var(--success)" : "var(--danger)",
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {p.drift_delta > 0 ? "+" : ""}
              {p.drift_delta.toFixed(1)} drift
            </span>
          </div>
        ))}
        {proposals.length > 3 && (
          <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
            +{proposals.length - 3} more pending
          </div>
        )}
      </div>
    </PanelShell>
  );
}

/* ---------------- shared chrome ---------------- */

function PanelShell({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        // Inset-panel surface fill per docs/design/instrument-field-pattern.md §3.1.
        // The 1px gap between panels (parent uses gap:1 + bg --border-subtle)
        // continues to read as a hairline divider because --border-subtle is
        // darker than --surface — same divider behavior, lifted panel fill.
        background: "var(--surface)",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: ".08em",
          }}
        >
          {label}
        </span>
        {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
      </div>
      {children}
    </div>
  );
}

function RegimePill({
  label,
  color,
  multiplier,
}: {
  label: string;
  color: string;
  multiplier: number;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10.5,
        fontFamily: "var(--m)",
        color,
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: "0 7px",
        letterSpacing: ".02em",
        textTransform: "capitalize",
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: color }} />
      {label} · {multiplier.toFixed(2)}×
    </span>
  );
}

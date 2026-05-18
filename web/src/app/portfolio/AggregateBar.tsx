import type { PortfolioSnapshot } from "@/lib/portfolio-types";
import { HeroNumber } from "@/components/primitives/HeroNumber";

/**
 * Portfolio top header — Mercury Pic 18/19 b2 pattern (Ops/Payroll +
 * Credit Card): big protagonist metric block + supporting cells.
 *
 * Market Value is the protagonist (HeroNumber at lg). Below sits a
 * supporting strip with Total Capital / Invested / P&L / Reserve — the
 * cells operators glance at without needing equal-weight prominence.
 * "Invested" was previously labeled "Deployed" — renamed per THS-86
 * compliance discipline (the verb "deploy" is on the banned list, the
 * noun form "Invested" is the industry-standard descriptor).
 *
 * Empty state (fixture mode, no positions): hero shows "$0" muted with
 * an honest "no positions yet" attribution rather than fake values.
 */
export function AggregateBar({ snap }: { snap: PortfolioSnapshot }) {
  const plPos = snap.total_pl >= 0;
  const plDelta =
    snap.total_market_value > 0
      ? { value: Number((snap.total_pl_pct * 100).toFixed(2)), period: "since open" }
      : null;
  const heroAttribution = snap.empty
    ? "no positions yet — add one via the form on the right"
    : snap.spy_as_of
      ? `prices as of ${snap.spy_as_of}`
      : "prices pending";

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Hero block — Market Value as the protagonist (spec §1.7, lambo 60% rule). */}
      <div style={{ padding: "8px 4px 18px" }}>
        <HeroNumber
          label="Market value"
          value={snap.total_market_value}
          prefix="$"
          precision={0}
          size="lg"
          valueColor={snap.empty ? "var(--text-4)" : "var(--text-1)"}
          delta={plDelta}
          derivation={
            snap.empty
              ? undefined
              : `${snap.positions.length} ${snap.positions.length === 1 ? "position" : "positions"} · ${fmtUsd(snap.total_deployed)} cost basis · ${fmtUsd(snap.reserve_actual)} reserve`
          }
          attribution={heroAttribution}
        />
      </div>

      {/* Supporting strip — Total Capital · Invested · P&L · Reserve.
          Mercury Pic 17 b2 KPI strip: top + bottom hairlines, cell dividers,
          no card chrome. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Kpi
          label="Total Capital"
          value={fmtUsd(snap.settings.total_capital)}
          sub="single-book capital cap"
          isFirst
        />
        <Kpi
          label="Invested"
          value={fmtUsd(snap.total_deployed)}
          sub={`${snap.positions.length} ${snap.positions.length === 1 ? "position" : "positions"}`}
        />
        <Kpi
          label="P&L"
          value={snap.empty ? "—" : fmtUsd(snap.total_pl, true)}
          sub={snap.empty ? "no positions yet" : `${plPos ? "+" : ""}${(snap.total_pl_pct * 100).toFixed(2)}% since open`}
          valueColor={snap.empty ? undefined : plPos ? "var(--success)" : "var(--danger)"}
          muted={snap.empty}
        />
        <Kpi
          label="Reserve"
          value={fmtUsd(snap.reserve_actual)}
          sub={`target ${fmtUsd(snap.settings.target_reserve)}`}
          valueColor={snap.reserve_actual >= snap.settings.target_reserve ? "var(--text-1)" : "var(--danger)"}
        />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  valueColor,
  isFirst = false,
  muted = false,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  isFirst?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        padding: "16px 22px",
        borderLeft: isFirst ? undefined : "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 20,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: muted ? "var(--text-4)" : (valueColor ?? "var(--text-1)"),
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 11, fontFamily: "var(--m)", color: "var(--text-3)" }}>{sub}</span>
      )}
    </div>
  );
}

function fmtUsd(n: number, signed = false): string {
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return `${sign}$${body}`;
}

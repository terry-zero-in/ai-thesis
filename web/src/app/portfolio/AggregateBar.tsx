import type { PortfolioSnapshot } from "@/lib/portfolio-types";

/**
 * Top-strip aggregate KPIs: deployed, market value, P&L $/%, reserve.
 * Server-rendered so values match the table exactly without any client
 * recomputation.
 */
export function AggregateBar({ snap }: { snap: PortfolioSnapshot }) {
  const plPos = snap.total_pl >= 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 1,
        background: "var(--border)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <Kpi label="Total Capital" value={fmtUsd(snap.settings.total_capital)} />
      <Kpi label="Deployed" value={fmtUsd(snap.total_deployed)} sub={`${snap.positions.length} ${snap.positions.length === 1 ? "position" : "positions"}`} />
      <Kpi label="Market Value" value={fmtUsd(snap.total_market_value)} />
      <Kpi
        label="P&L"
        value={fmtUsd(snap.total_pl, true)}
        valueColor={plPos ? "var(--success)" : "var(--danger)"}
        sub={`${plPos ? "+" : ""}${(snap.total_pl_pct * 100).toFixed(2)}%`}
      />
      <Kpi
        label="Reserve"
        value={fmtUsd(snap.reserve_actual)}
        sub={`target ${fmtUsd(snap.settings.target_reserve)}`}
        valueColor={snap.reserve_actual >= snap.settings.target_reserve ? "var(--text-1)" : "var(--danger)"}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
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
          fontSize: 18,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: valueColor ?? "var(--text-1)",
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

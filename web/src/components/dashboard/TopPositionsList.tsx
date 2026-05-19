import Link from "next/link";
import type { PositionRow } from "@/lib/portfolio-types";

/**
 * TopPositionsList — Score Movers' sibling on Dashboard canvas. Renders
 * the operator's actual book ranked by market value, rows on canvas (Strip
 * role per Instrument-Field §3.1), NOT a card. Hairline dividers, mono
 * numerics, full-row click → /portfolio (could deep-link to a position
 * view once that page exists).
 *
 * Empty state: a single onboarding line — KpiRow already carries the
 * primary "Add position" CTA on empty book, so no need to duplicate.
 *
 * Limit: 8 rows. Beyond that the canvas gets crowded and Score Movers
 * takes precedence — full list lives on /portfolio.
 */
const TOP_LIMIT = 8;

interface Row {
  ticker: string;
  name: string;
  layer_label: string;
  shares: number;
  marketValue: number;
  costBasis: number;
  pl: number;
  plPct: number;
}

const GRID = "84px minmax(0, 1fr) 120px 110px 90px 90px";

export function TopPositionsList({ positions }: { positions: PositionRow[] }) {
  if (positions.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-3)", padding: "6px 14px" }}>
        Your top holdings rank here once you add positions.
      </div>
    );
  }
  const rows = buildRows(positions);
  return (
    <div style={{ fontSize: 13, fontFamily: "var(--m)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          columnGap: 16,
          padding: "0 14px 10px",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          color: "var(--text-3)",
          fontWeight: 500,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <span>Ticker</span>
        <span>Name</span>
        <span>Layer</span>
        <span style={{ textAlign: "right" }}>Mkt value</span>
        <span style={{ textAlign: "right" }}>P&L</span>
        <span style={{ textAlign: "right" }}>P&L %</span>
      </div>
      <div>
        {rows.map((r, i) => (
          <PositionRowRender key={r.ticker} r={r} isLast={i === rows.length - 1} />
        ))}
      </div>
    </div>
  );
}

function PositionRowRender({ r, isLast }: { r: Row; isLast: boolean }) {
  const positive = r.pl >= 0;
  const plColor = positive ? "var(--success)" : "var(--danger)";
  return (
    <Link
      href={`/universe/${r.ticker}`}
      className="row-hov"
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        columnGap: 16,
        padding: "10px 14px",
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
        alignItems: "baseline",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{r.ticker}</span>
      <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
      <span style={{ color: "var(--text-3)", fontSize: 11 }}>{r.layer_label}</span>
      <span style={{ textAlign: "right", color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
        {fmtUsd(r.marketValue)}
      </span>
      <span style={{ textAlign: "right", color: plColor, fontVariantNumeric: "tabular-nums" }}>
        {positive ? "+" : ""}
        {fmtUsd(r.pl, true)}
      </span>
      <span style={{ textAlign: "right", color: plColor, fontVariantNumeric: "tabular-nums" }}>
        {positive ? "+" : ""}
        {(r.plPct * 100).toFixed(2)}%
      </span>
    </Link>
  );
}

function buildRows(positions: PositionRow[]): Row[] {
  const enriched = positions
    .filter((p) => p.closed_at == null) // open positions only
    .map((p) => {
      const price = p.current_price ?? 0;
      const marketValue = price * p.shares;
      const costTotal = p.cost_basis * p.shares;
      const pl = marketValue - costTotal;
      const plPct = costTotal > 0 ? pl / costTotal : 0;
      return {
        ticker: p.ticker,
        name: p.name,
        layer_label: p.layer_label,
        shares: p.shares,
        marketValue,
        costBasis: p.cost_basis,
        pl,
        plPct,
      };
    });
  enriched.sort((a, b) => b.marketValue - a.marketValue);
  return enriched.slice(0, TOP_LIMIT);
}

function fmtUsd(n: number, signed = false): string {
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${sign}$${body}`;
}

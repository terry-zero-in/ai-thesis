import Link from "next/link";
import type { PositionRow } from "@/lib/portfolio-types";
import type { DashboardScoreLite } from "@/lib/dashboard-data";
import type { Tier } from "@/lib/universe-data";

/**
 * TopPositionsList — Score Movers' sibling on Dashboard canvas. Renders
 * the operator's actual book ranked by market value, rows on canvas (Strip
 * role per Instrument-Field §3.1), NOT a card. Hairline dividers, mono
 * numerics, full-row click → /universe/[ticker].
 *
 * Columns (S11 expansion): Ticker · Name · Layer · Weight · Mkt value ·
 * Thesis grade · P&L · P&L %. Weight column shows position MV / NAV (book
 * MV + cash reserve) with a thin progress bar. Thesis grade pulls per-
 * ticker composite + tier from DashboardSnapshot.scoresByTicker.
 *
 * Reconciliation row ("N positions + cash") and Total row (Portfolio NAV)
 * close the math end-to-end per /lambo "math reconciles end-to-end."
 *
 * Empty state: a single onboarding line — KpiRow already carries the
 * primary "Add position" CTA on empty book.
 *
 * Limit: 8 rows. Full list on /portfolio.
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
  weight: number;
  score: DashboardScoreLite | undefined;
}

// Ticker · Name · Layer · Weight (bar + %) · Mkt value · Thesis · P&L · P&L %
const GRID = "72px minmax(0, 1fr) 100px 96px 100px 110px 90px 78px";

export function TopPositionsList({
  positions,
  scoresByTicker,
  totalCapital,
}: {
  positions: PositionRow[];
  scoresByTicker: Record<string, DashboardScoreLite>;
  totalCapital: number;
}) {
  if (positions.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-3)", padding: "6px 14px" }}>
        Your top holdings rank here once you add positions.
      </div>
    );
  }
  const built = buildRows(positions, scoresByTicker, totalCapital);
  return (
    <div style={{ fontSize: 13, fontFamily: "var(--m)" }}>
      <HeaderRow />
      <div>
        {built.rows.map((r, i) => (
          <PositionRowRender key={r.ticker} r={r} isLast={i === built.rows.length - 1} rowIndex={i} />
        ))}
      </div>
      <ReconcileRow
        rendered={built.rows.length}
        total={positions.length}
        cash={built.cashReserve}
        nav={built.nav}
      />
      <TotalRow
        totalMv={built.totalMv}
        nav={built.nav}
        booklevelPl={built.bookPl}
        bookCost={built.bookCost}
      />
    </div>
  );
}

function HeaderRow() {
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    color: "var(--text-3)",
    fontWeight: 500,
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        columnGap: 16,
        padding: "0 14px 6px",
        borderBottom: "1px solid var(--border-subtle)",
        ...labelStyle,
      }}
    >
      <span>Ticker</span>
      <span>Name</span>
      <span>Layer</span>
      <span style={{ textAlign: "right" }}>Weight</span>
      <span style={{ textAlign: "right" }}>Mkt value</span>
      <span style={{ textAlign: "right" }}>Thesis</span>
      <span style={{ textAlign: "right" }}>P&amp;L</span>
      <span style={{ textAlign: "right" }}>P&amp;L %</span>
    </div>
  );
}

function PositionRowRender({ r, isLast, rowIndex }: { r: Row; isLast: boolean; rowIndex: number }) {
  const positive = r.pl >= 0;
  const plColor = positive ? "var(--success)" : "var(--danger)";
  return (
    <Link
      href={`/universe/${r.ticker}`}
      className="row-hov row-stagger-in"
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        columnGap: 16,
        padding: "4px 14px",
        lineHeight: 1.2,
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
        alignItems: "center",
        textDecoration: "none",
        color: "inherit",
        ["--row-i" as never]: Math.min(rowIndex, 12),
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{r.ticker}</span>
      <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
      <span style={{ color: "var(--text-3)", fontSize: 11 }}>{r.layer_label}</span>
      <WeightCell weight={r.weight} />
      <span style={{ textAlign: "right", color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
        {fmtUsd(r.marketValue)}
      </span>
      <ThesisCell score={r.score} />
      <span style={{ textAlign: "right", color: plColor, fontVariantNumeric: "tabular-nums" }}>
        {fmtUsd(r.pl, true)}
      </span>
      <span style={{ textAlign: "right", color: plColor, fontVariantNumeric: "tabular-nums" }}>
        {positive ? "+" : ""}
        {(r.plPct * 100).toFixed(2)}%
      </span>
    </Link>
  );
}

function WeightCell({ weight }: { weight: number }) {
  // Bar width is weight normalized to the *largest expected single-name cap*
  // (10% per spec §"Position-construction guardrails"). Anything beyond cap
  // saturates the bar AND warns the value color so reader instantly sees
  // over-concentration without reading the number.
  const CAP = 0.10;
  const pct = weight * 100;
  const barPct = Math.min(100, (weight / CAP) * 100);
  const overCap = weight > CAP;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "stretch", minWidth: 0 }}>
      <span
        style={{
          textAlign: "right",
          color: overCap ? "var(--warning)" : "var(--text-2)",
          fontVariantNumeric: "tabular-nums",
          fontSize: 12,
        }}
        title={overCap ? `Over single-name cap (${(CAP * 100).toFixed(0)}%)` : undefined}
      >
        {pct.toFixed(1)}%
      </span>
      <div
        aria-hidden
        style={{
          height: 2,
          background: "rgba(255,255,255,.04)",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${barPct}%`,
            height: "100%",
            background: overCap ? "var(--warning)" : "var(--accent)",
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  );
}

function ThesisCell({ score }: { score: DashboardScoreLite | undefined }) {
  if (!score || score.tier == null || score.composite == null) {
    return (
      <span
        style={{
          textAlign: "right",
          color: "var(--text-4)",
          fontVariantNumeric: "tabular-nums",
          fontSize: 11,
          fontStyle: "italic",
        }}
        title="Not yet scored"
      >
        unscored
      </span>
    );
  }
  return (
    <span
      style={{
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        fontSize: 12,
        display: "inline-flex",
        gap: 6,
        justifyContent: "flex-end",
        alignItems: "baseline",
      }}
    >
      <span style={{ color: TIER_COLORS[score.tier], fontWeight: 600 }}>{score.tier}</span>
      <span style={{ color: "var(--text-3)" }}>{score.composite.toFixed(1)}</span>
    </span>
  );
}

const TIER_COLORS: Record<Tier, string> = {
  High: "var(--success)",
  Medium: "var(--text-1)",
  Low: "var(--warning)",
  Avoid: "var(--danger)",
};

function ReconcileRow({
  rendered,
  total,
  cash,
  nav,
}: {
  rendered: number;
  total: number;
  cash: number;
  nav: number;
}) {
  const cashWeight = nav > 0 ? cash / nav : 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        columnGap: 16,
        padding: "4px 14px",
        lineHeight: 1.2,
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 11,
        color: "var(--text-3)",
        whiteSpace: "nowrap",
        alignItems: "baseline",
        fontStyle: "italic",
      }}
    >
      <span>—</span>
      <span style={{ color: "var(--text-3)" }}>
        {total} position{total === 1 ? "" : "s"}
        {rendered < total ? ` · top ${rendered} shown` : ""} · cash reserve
      </span>
      <span>—</span>
      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {(cashWeight * 100).toFixed(1)}%
      </span>
      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtUsd(cash)}</span>
      <span />
      <span />
      <span />
    </div>
  );
}

function TotalRow({
  totalMv,
  nav,
  booklevelPl,
  bookCost,
}: {
  totalMv: number;
  nav: number;
  booklevelPl: number;
  bookCost: number;
}) {
  const positive = booklevelPl >= 0;
  const plColor = positive ? "var(--success)" : "var(--danger)";
  const plPct = bookCost > 0 ? booklevelPl / bookCost : 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        columnGap: 16,
        padding: "5px 14px",
        lineHeight: 1.2,
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 12,
        color: "var(--text-2)",
        whiteSpace: "nowrap",
        alignItems: "baseline",
        fontWeight: 500,
      }}
    >
      <span style={{ color: "var(--text-1)", fontWeight: 600, fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase" }}>
        NAV
      </span>
      <span style={{ color: "var(--text-3)" }}>Portfolio · book + cash</span>
      <span />
      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-1)" }}>
        100.0%
      </span>
      <span style={{ textAlign: "right", color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
        {fmtUsd(nav)}
      </span>
      <span style={{ textAlign: "right", color: "var(--text-3)", fontSize: 11 }}>
        book {fmtUsd(totalMv)}
      </span>
      <span style={{ textAlign: "right", color: plColor, fontVariantNumeric: "tabular-nums" }}>
        {fmtUsd(booklevelPl, true)}
      </span>
      <span style={{ textAlign: "right", color: plColor, fontVariantNumeric: "tabular-nums" }}>
        {positive ? "+" : ""}
        {(plPct * 100).toFixed(2)}%
      </span>
    </div>
  );
}

function buildRows(
  positions: PositionRow[],
  scoresByTicker: Record<string, DashboardScoreLite>,
  totalCapital: number,
): { rows: Row[]; totalMv: number; cashReserve: number; nav: number; bookPl: number; bookCost: number } {
  const enriched = positions
    .filter((p) => p.closed_at == null)
    .map((p) => {
      const price = p.current_price ?? p.cost_basis; // missing price → mark to cost, honest fallback
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
        costTotal,
      };
    });

  const totalMv = enriched.reduce((sum, p) => sum + p.marketValue, 0);
  const bookCost = enriched.reduce((sum, p) => sum + p.costTotal, 0);
  const bookPl = totalMv - bookCost;
  const cashReserve = Math.max(0, totalCapital - bookCost);
  const nav = totalMv + cashReserve;

  enriched.sort((a, b) => b.marketValue - a.marketValue);
  const top = enriched.slice(0, TOP_LIMIT).map<Row>((p) => ({
    ticker: p.ticker,
    name: p.name,
    layer_label: p.layer_label,
    shares: p.shares,
    marketValue: p.marketValue,
    costBasis: p.costBasis,
    pl: p.pl,
    plPct: p.plPct,
    weight: nav > 0 ? p.marketValue / nav : 0,
    score: scoresByTicker[p.ticker],
  }));

  return { rows: top, totalMv, cashReserve, nav, bookPl, bookCost };
}

function fmtUsd(n: number, signed = false): string {
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${sign}$${body}`;
}

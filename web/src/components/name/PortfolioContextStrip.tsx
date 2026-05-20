/**
 * PortfolioContextStrip — inline "your position" answer between NameHeader
 * and NameScoreChart on /universe/[ticker]. Two variants:
 *
 *   HELD: weight · cost basis · P&L · concentration tax
 *   NOT-HELD: "Not in portfolio · single-name cap 10%" + concentration tax
 *             when the engine has scored one (still useful diagnostic
 *             before entry — over-tax names are sized down regardless).
 *
 * Single-name cap pinned from spec §"Position-construction guardrails"
 * (docs/AI-Thesis-v2-Algorithm-and-Deployment.md line 353). Concentration
 * tax is the engine's [-15, 0] penalty (Saturday compute-concentration job).
 *
 * Visual posture is /lambo "quiet chrome" — header strip role, --text-2
 * values, --text-3 labels, no card chrome of its own (it sits inside the
 * page canvas, bordered top + bottom only so it reads as instrument-belt,
 * not a card). 4-column grid for held, single row for not-held.
 */
import Link from "next/link";
import { useState } from "react";
import type { NameDetail } from "@/lib/name-detail-data";

export function PortfolioContextStrip({ d }: { d: NameDetail }) {
  const tax = d.concentration_tax;
  const ctx = d.portfolio;

  // Shared style for each metric cell. Cells are clickable → /portfolio
  // (the source of position truth). Per Terry 2026-05-20 KPI-clickability
  // sweep: any KPI-type data with a logical drill-down destination gets a
  // Link + hover. Cell hover lifts to --surface-hover (one Linear-step
  // above the strip's --surface pill), readable inside the bounded pill.
  const cell = {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    minWidth: 0,
  };
  const labelStyle = {
    fontSize: 10.5,
    fontFamily: "var(--m)",
    color: "var(--text-3)",
    letterSpacing: ".08em",
    textTransform: "uppercase" as const,
  };
  const valueStyle = {
    fontFamily: "var(--m)",
    fontSize: 16,
    fontWeight: 500,
    color: "var(--text-2)",
    fontVariantNumeric: "tabular-nums" as const,
    letterSpacing: "-.006em",
  };

  if (ctx.held) {
    const overCap = ctx.weight > ctx.single_name_cap_pct;
    const plColor = ctx.pl >= 0 ? "var(--success)" : "var(--danger)";
    return (
      <Container>
        <KpiCell href="/portfolio" cellStyle={cell}>
          <span style={labelStyle}>Weight</span>
          <span
            style={{
              ...valueStyle,
              color: overCap ? "var(--warning)" : "var(--text-2)",
            }}
            title={overCap ? `Exceeds single-name cap (${pct(ctx.single_name_cap_pct, 0)})` : undefined}
          >
            {pct(ctx.weight)}
            <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 6, fontWeight: 400 }}>
              vs {pct(ctx.single_name_cap_pct, 0)} cap
            </span>
          </span>
        </KpiCell>
        <KpiCell href="/portfolio" cellStyle={cell}>
          <span style={labelStyle}>Cost basis</span>
          <span style={valueStyle}>
            {money(ctx.cost_basis)}
            <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 6, fontWeight: 400 }}>
              × {ctx.shares} sh
            </span>
          </span>
        </KpiCell>
        <KpiCell href="/portfolio" cellStyle={cell}>
          <span style={labelStyle}>P&amp;L</span>
          <span style={{ ...valueStyle, color: plColor }}>
            {ctx.pl >= 0 ? "+" : ""}
            {money(ctx.pl)}
            <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 6, fontWeight: 400 }}>
              {ctx.pl >= 0 ? "+" : ""}
              {pct(ctx.pl_pct)}
            </span>
          </span>
        </KpiCell>
        <KpiCell href="/portfolio" cellStyle={cell}>
          <span style={labelStyle}>Concentration tax</span>
          <span
            style={{
              ...valueStyle,
              color: tax != null && tax < 0 ? "var(--warning)" : "var(--text-3)",
            }}
            title="Engine penalty from compute-concentration (Sat 22:35 UTC). Range [-15, 0]; applied as additive to composite before macro multiplier."
          >
            {tax == null ? "—" : tax.toFixed(1)}
            <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 6, fontWeight: 400 }}>
              pts
            </span>
          </span>
        </KpiCell>
      </Container>
    );
  }

  // Not-held variant — left cell spans 3, tax cell on the right. Same
  // 4-col grid as held so the strip's geometry doesn't reflow between
  // tickers. Quiet posture; the strip's job here is to answer "is this in
  // my book?" — the answer is no. Cells still clickable → /portfolio (the
  // place to add the position from).
  return (
    <Container>
      <KpiCell href="/portfolio" cellStyle={{ ...cell, gridColumn: "span 3" }}>
        <span style={labelStyle}>Your position</span>
        <span style={valueStyle}>
          Not in portfolio
          <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 8, fontWeight: 400 }}>
            single-name cap {pct(ctx.single_name_cap_pct, 0)}
          </span>
        </span>
      </KpiCell>
      <KpiCell href="/portfolio" cellStyle={cell}>
        <span style={labelStyle}>Concentration tax</span>
        <span
          style={{
            ...valueStyle,
            color: tax != null && tax < 0 ? "var(--warning)" : "var(--text-3)",
          }}
          title="Engine penalty from compute-concentration (Sat 22:35 UTC). Range [-15, 0]; deeper tax = sized smaller if entered."
        >
          {tax == null ? "—" : tax.toFixed(1)}
          <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 6, fontWeight: 400 }}>
            pts
          </span>
        </span>
      </KpiCell>
    </Container>
  );
}

/**
 * Clickable KPI cell wrapper. Local hover state lifts background to
 * --surface-hover (one Linear-step above the strip's own --surface pill),
 * so the affordance is visible inside the bounded surface. Per S22 KPI-
 * clickability sweep: each metric is its own drill-down anchor.
 */
function KpiCell({
  href,
  cellStyle,
  children,
}: {
  href: string;
  cellStyle: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...cellStyle,
        textDecoration: "none",
        color: "inherit",
        padding: "6px 10px",
        margin: "-6px -10px",
        borderRadius: 5,
        background: hov ? "var(--surface-hover)" : "transparent",
        transition: "background var(--dur-fast) var(--ease-out)",
        cursor: "pointer",
      }}
    >
      {children}
    </Link>
  );
}

function Container({ children }: { children: React.ReactNode }) {
  // Pill geometry per Terry 2026-05-20 — see NamePager.Strip for the
  // global rule. Same 32 / 40 horizontal margin, same 6px radius. Vertical
  // margin tightens the gap to NameHeader (above) and the chart (below)
  // so the strip reads as instrument-belt, not floating.
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 24,
        margin: "8px 40px 10px 32px",
        padding: "12px 16px",
        borderRadius: 6,
        background: "var(--surface)",
        alignItems: "baseline",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function money(n: number): string {
  // Compact for absolute values >$10k; full thousands separator otherwise.
  const abs = Math.abs(n);
  if (abs >= 10000) {
    return `$${(n / 1000).toFixed(1)}k`;
  }
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function pct(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`;
}

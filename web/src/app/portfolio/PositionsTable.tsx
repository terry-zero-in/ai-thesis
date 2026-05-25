"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayerChip } from "@/components/universe/LayerChip";
import type { ClosedPositionRow, PositionRow } from "@/lib/portfolio-types";
import { POSITION_DRAWDOWN_TRIGGER } from "@/lib/portfolio-types";
import type { Tier } from "@/lib/universe-data";

/**
 * Positions table — one row per open position with cost / market / P&L
 * columns and a per-row "sell" affordance that opens the SellDrawer (via
 * ?sell=<TICKER>). The closed-positions section below renders any
 * historical sells with realized P&L.
 */
export function PositionsTable({
  positions,
  closedPositions,
  totalDeployed,
  highlightTicker,
}: {
  positions: PositionRow[];
  closedPositions: ClosedPositionRow[];
  totalDeployed: number;
  highlightTicker?: string;
}) {
  const hasOpen = positions.length > 0;
  const hasClosed = closedPositions.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {!hasOpen && !hasClosed ? (
        <EmptyState />
      ) : (
        <>
          {hasOpen && (
            <OpenTable
              positions={positions}
              totalDeployed={totalDeployed}
              highlightTicker={highlightTicker}
            />
          )}
          {hasClosed && <ClosedTable rows={closedPositions} />}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "40px 16px",
        fontSize: 13,
        color: "var(--text-3)",
        textAlign: "center",
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      No positions yet. Click <span style={{ fontFamily: "var(--m)", color: "var(--text-2)" }}>Add position</span> in the top-right to start tracking your book.
    </div>
  );
}

function OpenTable({
  positions,
  totalDeployed,
  highlightTicker,
}: {
  positions: PositionRow[];
  totalDeployed: number;
  highlightTicker?: string;
}) {
  if (positions.length === 0) return null;
  // Mercury decard: table sits on canvas with top + bottom hairlines, row
  // separators only. No outer card chrome.
  return (
    <div style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            <Th align="left">Ticker</Th>
            <Th align="left" title="Compute / Models / Apps · AI value-chain layer">Layer</Th>
            <Th align="left" title="Tier (High/Medium/Low/Avoid) · Composite score · Concentration tax">Thesis</Th>
            <Th align="right">Shares</Th>
            <Th align="right" title="Cost basis per share — what you paid">Cost</Th>
            <Th align="right" title="Latest close · FMP daily, refreshed every 5 min">Mark</Th>
            <Th align="right" title="Market value = mark × shares">Mkt Value</Th>
            <Th align="right" title="P&L in dollars since position opened">P&L $</Th>
            <Th align="right" title="P&L as a % of cost basis since position opened">P&L %</Th>
            <Th align="right" title="% of NAV (book + cash)">% Book</Th>
            <Th align="right" style={{ width: 116 }}>{""}</Th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => (
            <PositionRowView
              key={p.ticker}
              p={p}
              totalDeployed={totalDeployed}
              highlight={highlightTicker === p.ticker}
              rowIndex={i}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionRowView({
  p,
  totalDeployed,
  highlight,
  rowIndex,
}: {
  p: PositionRow;
  totalDeployed: number;
  highlight: boolean;
  rowIndex: number;
}) {
  const router = useRouter();
  const cost = p.cost_basis * p.shares;
  const hasPrice = p.current_price != null;
  const mv = hasPrice ? (p.current_price as number) * p.shares : cost;
  const pl = mv - cost;
  const plPct = cost > 0 ? pl / cost : 0;
  const pctBook = totalDeployed > 0 ? cost / totalDeployed : 0;
  const drawdownTriggered = hasPrice && plPct <= POSITION_DRAWDOWN_TRIGGER;

  // Whole-row click → /universe/{ticker}. Mirrors the Score Movers pattern
  // (S16). Edit/Sell cells contain their own interactive elements (Link,
  // form button) which handle their own click and don't bubble navigation.
  // .closest() check is the safety net.
  const onRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest("a, button, input, label, form")) return;
    router.push(`/universe/${p.ticker}`);
  };
  // Keyboard parity with the mouse path — Enter / Space on a focused row
  // navigates to the detail page. Linear-grade keyboarding: every clickable
  // surface is tabbable. The .closest() guard mirrors onRowClick so focus
  // landing on an inner Link/button doesn't double-navigate.
  const onRowKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget && t.closest("a, button, input, label, form")) return;
    e.preventDefault();
    router.push(`/universe/${p.ticker}`);
  };

  return (
    <tr
      className="row-hov row-stagger-in"
      onClick={onRowClick}
      onKeyDown={onRowKeyDown}
      tabIndex={0}
      aria-label={`Open ${p.ticker} detail`}
      style={{
        borderTop: "1px solid var(--border-subtle)",
        background: highlight
          ? "var(--accent-soft)"
          : drawdownTriggered
            ? "var(--danger-soft)"
            : undefined,
        // Custom property consumed by .row-stagger-in animation-delay calc.
        // Caps at 12 to keep stagger bounded — book larger than 12 names is
        // rare for an individual portfolio; tail rows arrive together.
        ["--row-i" as never]: Math.min(rowIndex, 12),
      }}
    >
      <Td align="left">
        <a
          href={`/universe/${p.ticker}`}
          style={{ color: "var(--text-1)", textDecoration: "none", fontFamily: "var(--m)", fontWeight: 600 }}
        >
          {p.ticker}
        </a>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{p.name}</div>
        {p.realized_pl !== 0 && (
          <div
            style={{
              fontSize: 10,
              fontFamily: "var(--m)",
              color: p.realized_pl >= 0 ? "var(--success)" : "var(--danger)",
              marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}
            title={`Realized ${fmtUsd(p.realized_pl, true)} from prior partial sales on this position. Cumulative.`}
          >
            realized {fmtUsd(p.realized_pl, true)}
          </div>
        )}
      </Td>
      <Td align="left">
        <LayerChip layer={p.layer} label={p.layer_label} />
      </Td>
      <Td align="left">
        <ThesisCell tier={p.tier} composite={p.composite} tax={p.concentration_tax} />
      </Td>
      <Td align="right">
        {p.shares}
        {p.original_shares != null && p.original_shares > p.shares && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-4)",
              fontFamily: "var(--m)",
              fontVariantNumeric: "tabular-nums",
            }}
            title={`Originally ${p.original_shares} shares; ${p.original_shares - p.shares} sold.`}
          >
            of {p.original_shares}
          </div>
        )}
      </Td>
      <Td align="right">{fmtUsd(p.cost_basis)}</Td>
      <Td align="right">
        {hasPrice ? (
          <span>
            {fmtUsd(p.current_price as number)}
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>{p.current_price_as_of}</div>
          </span>
        ) : (
          <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>—</span>
        )}
      </Td>
      <Td align="right">{fmtUsd(mv)}</Td>
      <Td align="right">
        <span style={{ color: pl >= 0 ? "var(--success)" : "var(--danger)" }}>{fmtUsd(pl, true)}</span>
      </Td>
      <Td align="right">
        <span style={{ color: pl >= 0 ? "var(--success)" : "var(--danger)" }}>{fmtPct(plPct, true)}</span>
        {drawdownTriggered && (
          <div
            className="chip-fade-in"
            title={`Drawdown trigger fired — position is ≥${Math.abs(POSITION_DRAWDOWN_TRIGGER * 100).toFixed(0)}% below cost basis. Review thesis.`}
            style={{
              fontSize: 9,
              fontFamily: "var(--m)",
              color: "var(--danger)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginTop: 2,
              cursor: "help",
            }}
          >
            ↘ trigger
          </div>
        )}
      </Td>
      <Td align="right">{fmtPct(pctBook)}</Td>
      <Td align="right">
        <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
          <EditLink ticker={p.ticker} />
          <SellLink ticker={p.ticker} />
        </div>
      </Td>
    </tr>
  );
}

/**
 * Per-row Edit affordance. Routes to ?edit=<ticker>#add-position which the
 * page reads server-side to pre-select the ticker in AddPositionForm; the
 * form's useEffect then hydrates every field from the existing row.
 */
function EditLink({ ticker }: { ticker: string }) {
  return (
    <Link
      href={`/portfolio?edit=${encodeURIComponent(ticker)}#add-position`}
      title="Edit position — opens the drawer with this ticker hydrated"
      className="lin-hov"
      style={pillStyle}
    >
      edit
    </Link>
  );
}

/**
 * Per-row Sell affordance. Routes to ?sell=<ticker> which mounts the
 * SellDrawer pre-filled with the ticker's current shares + cost basis.
 */
function SellLink({ ticker }: { ticker: string }) {
  return (
    <Link
      href={`/portfolio?sell=${encodeURIComponent(ticker)}`}
      title={`Sell shares of ${ticker} — opens the sell drawer with shares + mark prefilled`}
      className="lin-hov"
      style={pillStyle}
    >
      sell
    </Link>
  );
}

const pillStyle: React.CSSProperties = {
  height: 22,
  padding: "0 8px",
  fontSize: 10.5,
  fontFamily: "var(--m)",
  color: "var(--text-3)",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 3,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  cursor: "pointer",
};

/* ---------------- closed positions section ---------------- */

function ClosedTable({ rows }: { rows: ClosedPositionRow[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          padding: "0 4px",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Closed positions
        </span>
        <span style={{ fontSize: 10.5, color: "var(--text-4)", fontFamily: "var(--m)" }}>
          {rows.length} {rows.length === 1 ? "row" : "rows"} · realized P&L per name
        </span>
      </div>
      <div style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>
              <Th align="left">Ticker</Th>
              <Th align="left">Layer</Th>
              <Th align="right" title="Total shares sold on this position">Sold</Th>
              <Th align="right" title="Cost basis per share at the time of opening">Cost</Th>
              <Th align="right" title="Most recent exit price (one or many sales)">Last exit</Th>
              <Th align="right" title="Date the position fully closed (shares reached 0)">Closed</Th>
              <Th align="right" title="Realized P&L = (exit − cost) × shares_sold, summed across sales">Realized $</Th>
              <Th align="right" title="Realized P&L as % of total cost basis (cost × shares_sold)">Realized %</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <ClosedRowView key={`${r.ticker}-${r.closed_at}-${i}`} r={r} rowIndex={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClosedRowView({ r, rowIndex }: { r: ClosedPositionRow; rowIndex: number }) {
  const router = useRouter();
  const pos = r.realized_pl >= 0;
  return (
    <tr
      className="row-hov row-stagger-in"
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("a, button, input, label, form")) return;
        router.push(`/universe/${r.ticker}`);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const t = e.target as HTMLElement;
        if (t !== e.currentTarget && t.closest("a, button, input, label, form")) return;
        e.preventDefault();
        router.push(`/universe/${r.ticker}`);
      }}
      tabIndex={0}
      aria-label={`Open ${r.ticker} detail`}
      style={{
        borderTop: "1px solid var(--border-subtle)",
        ["--row-i" as never]: Math.min(rowIndex, 12),
      }}
    >
      <Td align="left">
        <a
          href={`/universe/${r.ticker}`}
          style={{
            color: "var(--text-2)",
            textDecoration: "none",
            fontFamily: "var(--m)",
            fontWeight: 600,
          }}
        >
          {r.ticker}
        </a>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{r.name}</div>
      </Td>
      <Td align="left">
        <LayerChip layer={r.layer} label={r.layer_label} />
      </Td>
      <Td align="right">
        {r.shares_sold}
        <div
          style={{
            fontSize: 10,
            color: "var(--text-4)",
            fontFamily: "var(--m)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          opened {r.opened_at}
        </div>
      </Td>
      <Td align="right">{fmtUsd(r.cost_basis)}</Td>
      <Td align="right">
        {r.exit_price != null ? fmtUsd(r.exit_price) : <span style={{ color: "var(--text-4)" }}>—</span>}
      </Td>
      <Td align="right">{r.closed_at}</Td>
      <Td align="right">
        <span style={{ color: pos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
          {fmtUsd(r.realized_pl, true)}
        </span>
      </Td>
      <Td align="right">
        <span style={{ color: pos ? "var(--success)" : "var(--danger)" }}>
          {r.realized_pl_pct != null ? fmtPct(r.realized_pl_pct, true) : <span style={{ color: "var(--text-4)" }}>—</span>}
        </span>
      </Td>
    </tr>
  );
}

/* ---------------- thesis cell ---------------- */

function Th({
  children,
  align,
  style,
  title,
}: {
  children: React.ReactNode;
  align: "left" | "right";
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <th
      title={title}
      style={{
        textAlign: align,
        padding: "10px 12px",
        fontSize: 10.5,
        fontWeight: 500,
        fontFamily: "var(--m)",
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: ".06em",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: title ? "help" : undefined,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align: "left" | "right" }) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "10px 12px",
        fontFamily: "var(--m)",
        fontVariantNumeric: "tabular-nums",
        color: "var(--text-1)",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

/**
 * Thesis cell — tier label colored by band + composite number + optional
 * concentration-tax chip. Mirrors the Dashboard TopPositionsList ThesisCell
 * (per Perplexity Portfolio review #9/#5). Quiet treatment per /lambo's
 * quiet-chrome principle: tax chip muted unless |tax| ≥ 3pts (warning).
 */
function ThesisCell({
  tier,
  composite,
  tax,
}: {
  tier: Tier | null;
  composite: number | null;
  tax: number | null;
}) {
  if (tier == null || composite == null) {
    return <span style={{ color: "var(--text-4)", fontStyle: "italic" }}>—</span>;
  }
  const tierColor = TIER_COLOR[tier] ?? "var(--text-2)";
  const heavyDrag = tax != null && tax <= -3;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ color: tierColor, fontWeight: 600, letterSpacing: ".02em" }}>{tier}</span>
        <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums", fontSize: 11.5 }}>
          {composite.toFixed(1)}
        </span>
      </span>
      {tax != null && (
        <span
          title={`Concentration tax: ${tax.toFixed(1)} pts. Engine drag from over-concentration (range −15 to 0).`}
          style={{
            fontSize: 10,
            fontFamily: "var(--m)",
            color: heavyDrag ? "var(--warning)" : "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: ".02em",
          }}
        >
          tax {tax.toFixed(1)}
        </span>
      )}
    </div>
  );
}

const TIER_COLOR: Record<Tier, string> = {
  High: "var(--success)",
  Medium: "var(--text-1)",
  Low: "var(--warning)",
  Avoid: "var(--danger)",
};

function fmtUsd(n: number, signed = false): string {
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return `${sign}$${body}`;
}

function fmtPct(n: number, signed = false): string {
  const sign = signed && n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(2)}%`;
}

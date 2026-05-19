"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LayerChip } from "@/components/universe/LayerChip";
import type { PositionRow } from "@/lib/portfolio-types";
import { POSITION_DRAWDOWN_TRIGGER } from "@/lib/portfolio-types";
import type { Tier } from "@/lib/universe-data";
import { closePosition } from "./actions";
import { POSITION_INITIAL, type PositionFormState } from "./action-types";

/**
 * Positions table — one row per open position with cost / market / P&L
 * columns and a per-row "close" button that fires a server action.
 */
export function PositionsTable({
  positions,
  totalDeployed,
  highlightTicker,
}: {
  positions: PositionRow[];
  totalDeployed: number;
  highlightTicker?: string;
}) {
  if (positions.length === 0) {
    return (
      <div
        style={{
          padding: "28px 8px",
          fontSize: 13,
          color: "var(--text-3)",
          textAlign: "center",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        No open positions yet. Add the first one using the form on the right.
      </div>
    );
  }

  // Mercury decard: table sits on canvas with top + bottom hairlines, row
  // separators only. No outer card chrome.
  return (
    <div style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            <Th align="left">Ticker</Th>
            <Th align="left">Layer</Th>
            <Th align="left">Thesis</Th>
            <Th align="right">Shares</Th>
            <Th align="right">Cost</Th>
            <Th align="right">Mark</Th>
            <Th align="right">Mkt Value</Th>
            <Th align="right">P&L $</Th>
            <Th align="right">P&L %</Th>
            <Th align="right" title="% of NAV (book + cash)">% Book</Th>
            <Th align="right" style={{ width: 116 }}>{""}</Th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <PositionRowView
              key={p.ticker}
              p={p}
              totalDeployed={totalDeployed}
              highlight={highlightTicker === p.ticker}
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
}: {
  p: PositionRow;
  totalDeployed: number;
  highlight: boolean;
}) {
  const cost = p.cost_basis * p.shares;
  const hasPrice = p.current_price != null;
  const mv = hasPrice ? (p.current_price as number) * p.shares : cost;
  const pl = mv - cost;
  const plPct = cost > 0 ? pl / cost : 0;
  const pctBook = totalDeployed > 0 ? cost / totalDeployed : 0;
  const drawdownTriggered = hasPrice && plPct <= POSITION_DRAWDOWN_TRIGGER;

  return (
    <tr
      style={{
        borderTop: "1px solid var(--border-subtle)",
        background: highlight
          ? "var(--accent-soft)"
          : drawdownTriggered
            ? "var(--danger-soft)"
            : undefined,
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
      </Td>
      <Td align="left">
        <LayerChip layer={p.layer} label={p.layer_label} />
      </Td>
      <Td align="left">
        <ThesisCell tier={p.tier} composite={p.composite} tax={p.concentration_tax} />
      </Td>
      <Td align="right">{p.shares}</Td>
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
            style={{
              fontSize: 9,
              fontFamily: "var(--m)",
              color: "var(--danger)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginTop: 2,
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
          <CloseButton ticker={p.ticker} />
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
      title="Edit position"
      style={{
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
      }}
    >
      edit
    </Link>
  );
}

function CloseButton({ ticker }: { ticker: string }) {
  const [state, formAction, pending] = useActionState<PositionFormState, FormData>(closePosition, POSITION_INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="ticker" value={ticker} />
      <button
        type="submit"
        disabled={pending}
        title={state.message || "Mark position closed"}
        style={{
          height: 22,
          padding: "0 8px",
          fontSize: 10.5,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 3,
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {pending ? "…" : "close"}
      </button>
    </form>
  );
}

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

"use client";

import { useActionState } from "react";
import { LayerChip } from "@/components/universe/LayerChip";
import type { PositionRow } from "@/lib/portfolio-types";
import { POSITION_DRAWDOWN_TRIGGER } from "@/lib/portfolio-types";
import { closePosition, POSITION_INITIAL, type PositionFormState } from "./actions";

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
            <Th align="right">Shares</Th>
            <Th align="right">Cost</Th>
            <Th align="right">Mark</Th>
            <Th align="right">Mkt Value</Th>
            <Th align="right">P&L $</Th>
            <Th align="right">P&L %</Th>
            <Th align="right">% Book</Th>
            <Th align="right" style={{ width: 64 }}>{""}</Th>
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
        <CloseButton ticker={p.ticker} />
      </Td>
    </tr>
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
}: {
  children: React.ReactNode;
  align: "left" | "right";
  style?: React.CSSProperties;
}) {
  return (
    <th
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

function fmtUsd(n: number, signed = false): string {
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return `${sign}$${body}`;
}

function fmtPct(n: number, signed = false): string {
  const sign = signed && n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(2)}%`;
}

import type { NameForm4Row } from "@/lib/name-detail-data";

/**
 * Recent Form 4 (insider) transactions for a single ticker. Replaces
 * the prior DataPendingCard placeholder — Form 4 ingestion shipped
 * tonight and lives in insider_form4_raw.
 *
 * Universe coverage: ~5 of 50 tickers have recent transaction-coded
 * filings (P/S/A/M/F). The other 45 only file Form 3/5/amendments
 * which carry no transaction code — those are correctly filtered out
 * at ingest. For those tickers, show a quiet "monitored daily" line
 * instead of a placeholder card.
 */

const CODE_LABEL: Record<string, string> = {
  P: "Purchase",
  S: "Sale",
  A: "Award",
  M: "Exempt",
  F: "InKind",
  G: "Gift",
  D: "Disposition",
  C: "Conversion",
  X: "Option exercise",
};

const CODE_COLOR: Record<string, string> = {
  P: "var(--success)",
  S: "var(--danger)",
};

export function Form4Section({ rows, isFirst = false }: { rows: NameForm4Row[]; isFirst?: boolean }) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderLeft: isFirst ? undefined : "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Insider Form 4
        </span>
        <span style={{ fontSize: 10, fontFamily: "var(--m)", color: "var(--text-4)" }}>
          source: SEC EDGAR · daily
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
          No recent Form 4 transactions · monitored daily.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.slice(0, 5).map((r, i) => (
            <Form4Row key={`${r.transaction_date}-${r.insider_name}-${i}`} r={r} isLast={i === Math.min(rows.length, 5) - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function Form4Row({ r, isLast }: { r: NameForm4Row; isLast: boolean }) {
  const codeLabel = CODE_LABEL[r.transaction_code] ?? r.transaction_code;
  const codeColor = CODE_COLOR[r.transaction_code] ?? "var(--text-2)";
  const valueStr = r.transaction_value != null
    ? fmtUsdShort(r.transaction_value)
    : r.shares != null && r.price_per_share != null
      ? fmtUsdShort(r.shares * r.price_per_share)
      : null;
  return (
    <div
      style={{
        padding: "8px 0",
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 11, fontFamily: "var(--m)", color: "var(--text-3)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {r.transaction_date}
        </span>
        <span style={{ fontSize: 11, color: codeColor, fontFamily: "var(--m)", letterSpacing: ".04em", textTransform: "uppercase", flexShrink: 0 }}>
          {codeLabel}
        </span>
        {valueStr && (
          <span style={{ fontSize: 12, fontFamily: "var(--m)", color: "var(--text-1)", fontVariantNumeric: "tabular-nums", marginLeft: "auto", flexShrink: 0 }}>
            {valueStr}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          lineHeight: 1.4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={`${r.insider_name}${r.insider_title ? ` · ${r.insider_title}` : ""}`}
      >
        {r.insider_name}
        {r.insider_title && <span style={{ color: "var(--text-4)" }}> · {r.insider_title}</span>}
        {r.is_10b5_1 && <span style={{ color: "var(--text-4)" }}> · 10b5-1</span>}
      </div>
    </div>
  );
}

function fmtUsdShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

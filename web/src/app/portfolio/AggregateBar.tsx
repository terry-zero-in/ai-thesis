import type { PortfolioSnapshot } from "@/lib/portfolio-types";

/**
 * Portfolio hero — Mercury "format on canvas" + Basis Rent-Roll pattern.
 *
 * Column weights (2fr / 1fr / 1fr / 1fr) — Market Value is the sole
 * protagonist; cols 2-4 are equal-weight supporting columns:
 *   1. MARKET VALUE        — protagonist hero + concentration drag
 *   2. REALIZED P&L        — cumulative across all sells (THS-103)
 *   3. P&L · SINCE OPEN    — unrealized (open positions only)
 *   4. RESERVE             — cash + realized P&L − deployed
 *
 * S31 (THS-103) replaced the previous "30D Performance" column with
 * Realized P&L. 30D required NAV history that doesn't wire up until daily
 * price ingestion is firing; Realized P&L is concrete the moment any sell
 * lands. The dashboard NAV chart owns 30D trend at the system level.
 *
 * Empty state: every hero shows muted em-dash; honest, no fake values.
 */

export function AggregateBar({ snap }: { snap: PortfolioSnapshot }) {
  const plPos = snap.total_pl >= 0;
  const realizedPos = snap.total_realized_pl >= 0;
  const hasRealizedActivity = snap.total_realized_proceeds > 0;
  const realizedPctOnProceeds = hasRealizedActivity
    ? snap.total_realized_pl / snap.total_realized_proceeds
    : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1fr",
        gap: 32,
        padding: "20px 4px 24px",
        alignItems: "start",
      }}
    >
      {/* Col 1 — MARKET VALUE (protagonist).
          Since-open % lives in Col 3 (P&L · since open) — Market Value owns
          "what is this worth," P&L owns "what is the return." Two cols, two
          roles, no double-counting. */}
      <Column label="Market value">
        {snap.empty ? (
          <BigNumber value="—" color="var(--text-4)" />
        ) : (
          <BigNumber value={fmtUsd(snap.total_market_value)} color="var(--text-1)" />
        )}
        <SubLine>
          {snap.empty ? (
            "no positions yet — add one via the form on the right"
          ) : (
            <>
              {snap.positions.length}{" "}
              {snap.positions.length === 1 ? "position" : "positions"} ·{" "}
              {fmtUsd(snap.total_deployed)} invested · {fmtUsd(snap.settings.total_capital)} cap
            </>
          )}
        </SubLine>
        {!snap.empty && snap.portfolio_concentration_tax != null && (
          <SubLine>
            <span
              title="Sum of concentration_history.tax across held names. Range [−15, 0] per ticker. Engine drag from over-concentration on the post-macro composite score."
              style={{
                color: snap.portfolio_concentration_tax < 0 ? "var(--warning)" : "var(--text-3)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              concentration drag {snap.portfolio_concentration_tax.toFixed(1)} pts
            </span>
          </SubLine>
        )}
      </Column>

      {/* Col 2 — REALIZED P&L · all time.
          Cumulative across every sale (partial or full). Replaces the 30D
          Performance column that required NAV history not yet wired. The
          subline shows the realized return as a % of gross proceeds — the
          honest "what % of cash that flowed back was profit" framing. */}
      <Column label="Realized P&L">
        {hasRealizedActivity ? (
          <BigNumber
            value={fmtUsd(snap.total_realized_pl, true)}
            color={realizedPos ? "var(--success)" : "var(--danger)"}
          />
        ) : (
          <BigNumber value="—" color="var(--text-4)" />
        )}
        <SubLine>
          {hasRealizedActivity && realizedPctOnProceeds != null
            ? `${realizedPos ? "+" : ""}${(realizedPctOnProceeds * 100).toFixed(2)}% on ${fmtUsd(
                snap.total_realized_proceeds,
              )} proceeds`
            : "no sells yet — populates when you close a position"}
        </SubLine>
      </Column>

      {/* Col 3 — P&L · SINCE OPEN (unrealized on currently-held positions) */}
      <Column label="P&L · since open">
        {snap.empty ? (
          <BigNumber value="—" color="var(--text-4)" />
        ) : (
          <BigNumber
            value={fmtUsd(snap.total_pl, true)}
            color={plPos ? "var(--success)" : "var(--danger)"}
          />
        )}
        <SubLine>
          {snap.empty
            ? "no positions yet"
            : `${plPos ? "+" : ""}${(snap.total_pl_pct * 100).toFixed(2)}% unrealized`}
        </SubLine>
      </Column>

      {/* Col 4 — RESERVE
          Formula: capital + realized_pl − deployed-in-open. Realized profits
          grow the pool; losses shrink it. Sub-line shows target. */}
      <Column label="Reserve">
        <BigNumber
          value={fmtUsd(snap.reserve_actual)}
          color={snap.reserve_actual >= snap.settings.target_reserve ? "var(--text-1)" : "var(--danger)"}
        />
        <SubLine>target {fmtUsd(snap.settings.target_reserve)}</SubLine>
      </Column>
    </div>
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
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
        {label}
      </span>
      {children}
    </div>
  );
}

function BigNumber({ value, color }: { value: string; color: string }) {
  return <span style={bigNumberStyle(color)}>{value}</span>;
}

/**
 * Shared style for hero values across the 4 AggregateBar columns. Lifted
 * into a factory so BigNumber (em-dash empty state) and AnimateNumber
 * (animated count-up) render at identical scale/weight/rhythm — the only
 * difference is whether the text content rolls or is static.
 */
function bigNumberStyle(color: string): React.CSSProperties {
  return {
    fontFamily: "var(--m)",
    fontSize: 36,
    fontWeight: 600,
    color,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
    letterSpacing: "-.01em",
    marginTop: 2,
  };
}

function SubLine({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--m)",
        fontSize: 12,
        color: "var(--text-3)",
        marginTop: 4,
      }}
    >
      {children}
    </span>
  );
}

function fmtUsd(n: number, signed = false): string {
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return `${sign}$${body}`;
}

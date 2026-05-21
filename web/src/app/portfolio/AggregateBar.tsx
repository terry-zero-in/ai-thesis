import type { PortfolioSnapshot } from "@/lib/portfolio-types";

/**
 * Portfolio hero — Mercury "format on canvas" + Basis Rent-Roll pattern.
 *
 * Demo-data removal 2026-05-21 (Terry directive: personal tool, blank is
 * OK if data isn't there). The deterministic walk that powered the 30D
 * Performance column is gone — 30D now renders muted "—" until real NAV
 * history wires up.
 *
 * Column weights (2fr / 1fr / 1fr / 1fr) — Market Value is the sole
 * protagonist; cols 2-4 are equal-weight supporting columns:
 *   1. MARKET VALUE        — protagonist hero + concentration drag
 *   2. 30D PERFORMANCE     — pending until NAV history is tracked
 *   3. P&L · SINCE OPEN    — small hero
 *   4. RESERVE             — small hero
 *
 * Empty state: every hero shows muted em-dash; honest, no fake values.
 */

export function AggregateBar({ snap }: { snap: PortfolioSnapshot }) {
  const plPos = snap.total_pl >= 0;

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

      {/* Col 2 — 30D PERFORMANCE
          Demo-data removal 2026-05-21: real 30D delta requires NAV history
          which isn't wired yet. Renders muted "—" with the same honest sub
          the Dashboard already uses on its 30D return tile. Wires up once
          a portfolio_nav_daily source lands. */}
      <Column label="30D performance">
        <BigNumber value="—" color="var(--text-4)" />
        <SubLine>tracks once positions have ≥30d of history</SubLine>
      </Column>

      {/* Col 3 — P&L · SINCE OPEN */}
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
            : `${plPos ? "+" : ""}${(snap.total_pl_pct * 100).toFixed(2)}%`}
        </SubLine>
      </Column>

      {/* Col 4 — RESERVE */}
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


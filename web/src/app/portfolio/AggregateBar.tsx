import type { PortfolioSnapshot } from "@/lib/portfolio-types";

/**
 * Portfolio hero — Mercury "format on canvas" + Basis Rent-Roll pattern:
 * 4 protagonist columns, no vertical dividers, no card chrome, whitespace
 * as the separator.
 *
 * Count-up motion removed 2026-05-20 (Terry directive: count-up only on
 * very first Dashboard load ever, never on any other page). Numbers
 * render static — same scale/weight/color as before, just without the
 * 0 → value roll.
 *
 * Column weights (2fr / 1fr / 1fr / 1fr) — Market Value is the sole
 * protagonist; cols 2-4 are equal-weight supporting columns:
 *   1. MARKET VALUE        — protagonist hero ($77,992) + concentration drag
 *   2. 30D PERFORMANCE     — delta % (scalar, no sparkline)
 *   3. P&L · SINCE OPEN    — small hero (-$1,483)
 *   4. RESERVE             — small hero ($20,525)
 *
 * Sparkline retired 2026-05-19 (Terry): the 80×20 inline sparkline made
 * tame fluctuations look dramatic AND broke vertical rhythm against
 * cols 1/3/4. The hero number carries direction; the historical shape
 * lives on the NAV chart in the Dashboard.
 *
 * Empty state: hero shows muted em-dash with an honest "no positions yet"
 * sub. Other 3 columns render as quiet em-dashes — no fake values.
 */
const CHART_DAYS = 30;

export function AggregateBar({ snap }: { snap: PortfolioSnapshot }) {
  const plPos = snap.total_pl >= 0;

  // 30D sparkline data — same deterministic walk used in PortfolioHeroChart.
  const sparkData = synthesize(snap.total_market_value, CHART_DAYS, snap.empty);
  const sparkStart = sparkData[0];
  const sparkChange = snap.total_market_value - sparkStart;
  const sparkPct = sparkStart > 0 ? (sparkChange / sparkStart) * 100 : 0;
  const sparkPos = sparkChange >= 0;

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

      {/* Col 2 — 30D PERFORMANCE (scalar delta, no sparkline) */}
      <Column label="30D performance">
        {snap.empty ? (
          <BigNumber value="—" color="var(--text-4)" />
        ) : (
          <>
            <BigNumber
              value={`${sparkPos ? "+" : ""}${sparkPct.toFixed(2)}%`}
              color={sparkPos ? "var(--success)" : "var(--danger)"}
            />
            <SubLine>
              {sparkPos ? "+" : ""}${Math.abs(sparkChange).toLocaleString("en-US", { maximumFractionDigits: 0 })} on 30d
            </SubLine>
          </>
        )}
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

/**
 * Same deterministic walk as PortfolioHeroChart so the two surfaces show
 * coherent data shapes. Inlined to keep AggregateBar self-contained.
 */
function synthesize(currentValue: number, days: number, empty: boolean): number[] {
  if (empty || currentValue <= 0) return Array(days).fill(0);
  const seed = Math.floor(currentValue);
  const result: number[] = [];
  let v = currentValue;
  let s = seed;
  for (let i = 0; i < days; i++) {
    result.unshift(v);
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const noise = (s / 0x7fffffff - 0.5) * 0.012;
    v = v / (1 + noise);
    if (v < currentValue * 0.5) v = currentValue * 0.5;
    if (v > currentValue * 2) v = currentValue * 2;
  }
  return result;
}

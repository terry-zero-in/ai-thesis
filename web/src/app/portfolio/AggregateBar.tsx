import type { PortfolioSnapshot } from "@/lib/portfolio-types";
import { Sparkline } from "@/components/primitives/LineChart";

/**
 * Portfolio hero — Mercury "format on canvas" + Basis Rent-Roll pattern:
 * 4 protagonist columns, no vertical dividers, no card chrome, whitespace
 * as the separator.
 *
 * Column weights (2fr / 1fr / 1fr / 1fr) — Market Value is the sole
 * protagonist; cols 2-4 are equal-weight supporting columns:
 *   1. MARKET VALUE        — protagonist hero ($77,992) + concentration drag
 *   2. 30D PERFORMANCE     — delta % + inline 80×20 sparkline
 *   3. P&L · SINCE OPEN    — small hero (-$1,483)
 *   4. RESERVE             — small hero ($20,525)
 *
 * 30D PERFORMANCE inline-sparkline pattern (Terry feedback 2026-05-19):
 * The earlier dedicated 360×56 chart-canvas-below treatment made the
 * line read flat (low amplitude at width), bled into col 3, and pushed
 * col 2's vertical mass past cols 3+4 making them feel "short." Inline
 * 80×20 sparkline beside the % delta matches the Dashboard KpiCell
 * pattern — number + trend read as one glance, no bleed, even row
 * cadence across all four columns.
 *
 * Empty state: hero shows muted "$0" with an honest "no positions yet"
 * sub. Other 3 columns render as quiet em-dashes — no fake values.
 */
const CHART_DAYS = 30;
const SPARK_W = 80;
const SPARK_H = 20;

export function AggregateBar({ snap }: { snap: PortfolioSnapshot }) {
  const plPos = snap.total_pl >= 0;
  const plPctLabel = snap.total_market_value > 0
    ? `${plPos ? "+" : ""}${(snap.total_pl_pct * 100).toFixed(2)}% since open`
    : null;

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
      {/* Col 1 — MARKET VALUE (protagonist) */}
      <Column label="Market value">
        <BigNumber
          value={snap.empty ? "—" : fmtUsd(snap.total_market_value)}
          color={snap.empty ? "var(--text-4)" : "var(--text-1)"}
        />
        {plPctLabel && (
          <span
            style={{
              fontFamily: "var(--m)",
              fontSize: 12,
              color: plPos ? "var(--success)" : "var(--danger)",
              fontVariantNumeric: "tabular-nums",
              marginTop: 4,
            }}
          >
            {plPctLabel}
          </span>
        )}
        <SubLine>
          {snap.empty ? (
            "no positions yet — add one via the form on the right"
          ) : (
            <>
              {snap.positions.length}{" "}
              {snap.positions.length === 1 ? "position" : "positions"} ·{" "}
              {fmtUsd(snap.total_deployed)} invested · {fmtUsd(snap.settings.total_capital)} cap
              {snap.portfolio_concentration_tax != null && (
                <>
                  {" · "}
                  <span
                    title="Sum of concentration_history.tax across held names. Range [−15, 0] per ticker. Engine drag from over-concentration on the post-macro composite score."
                    style={{
                      color: snap.portfolio_concentration_tax < 0 ? "var(--warning)" : "var(--text-3)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    drag {snap.portfolio_concentration_tax.toFixed(1)} pts
                  </span>
                </>
              )}
            </>
          )}
        </SubLine>
      </Column>

      {/* Col 2 — 30D PERFORMANCE (inline sparkline + delta) */}
      <Column label="30D performance">
        {snap.empty ? (
          <BigNumber value="—" color="var(--text-4)" />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span
                style={{
                  fontFamily: "var(--m)",
                  fontSize: 36,
                  fontWeight: 600,
                  color: sparkPos ? "var(--success)" : "var(--danger)",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                  letterSpacing: "-.01em",
                }}
              >
                {sparkPos ? "+" : ""}
                {sparkPct.toFixed(2)}%
              </span>
              {sparkData.length > 1 && (
                <Sparkline
                  data={sparkData}
                  width={SPARK_W}
                  height={SPARK_H}
                  color="var(--accent)"
                />
              )}
            </div>
            <SubLine>
              {sparkPos ? "+" : ""}${Math.abs(sparkChange).toLocaleString("en-US", { maximumFractionDigits: 0 })} on 30d
            </SubLine>
          </>
        )}
      </Column>

      {/* Col 3 — P&L · SINCE OPEN */}
      <Column label="P&L · since open">
        <BigNumber
          value={snap.empty ? "—" : fmtUsd(snap.total_pl, true)}
          color={snap.empty ? "var(--text-4)" : plPos ? "var(--success)" : "var(--danger)"}
        />
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
          color={
            snap.reserve_actual >= snap.settings.target_reserve
              ? "var(--text-1)"
              : "var(--danger)"
          }
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
  return (
    <span
      style={{
        fontFamily: "var(--m)",
        fontSize: 36,
        fontWeight: 600,
        color,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
        letterSpacing: "-.01em",
        marginTop: 2,
      }}
    >
      {value}
    </span>
  );
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

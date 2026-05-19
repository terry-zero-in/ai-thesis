import { getDashboardSnapshot, getRecentInsider, type DashboardMover } from "@/lib/dashboard-data";
import type { Tier } from "@/lib/universe-data";
import { getPortfolioSnapshot } from "@/lib/portfolio-data";
import { getRegimeSnapshot } from "@/lib/regime-data";
import { type GaugeKey } from "@/lib/regime-types";
import { DashboardRailRegister } from "@/components/rails/DashboardRailRegister";
import Link from "next/link";
import { GreetingStrip } from "@/app/GreetingStrip";
import { computeGreeting } from "@/app/greeting-compute";
import { PortfolioValueChart } from "@/components/dashboard/PortfolioValueChart";
import { TopPositionsList } from "@/components/dashboard/TopPositionsList";
import { ScoreMathPopover } from "@/components/primitives/ScoreMathPopover";
import type { ScoreMathInput } from "@/components/primitives/ScoreMath";
import { AnimateNumber, type AnimateNumberKind } from "@/components/primitives/AnimateNumber";
import { getSupabaseServer } from "@/lib/supabase/server";
import { MarketingLanding } from "@/components/marketing/MarketingLanding";

/**
 * Revalidate every 30 min. Scores update on the Saturday chain;
 * macro gauges update daily. 30 min keeps the page reasonably fresh
 * without spamming the DB during weekday traffic.
 */
export const revalidate = 1800;

/** Tier → token map per spec §2.1: High=accent, Medium=warning, Low=info, Avoid=danger. */
const TIER_COLORS: Record<string, string> = {
  High: "var(--success)",
  Medium: "var(--text-1)",
  Low: "var(--warning)",
  Avoid: "var(--danger)",
};

/** Unified movers limit shown on dashboard table — top abs(Δ7D). */
const SCORE_MOVERS_LIMIT = 8;

/** Tier sort order — duplicates dashboard-data's local const (not exported). */
const RAIL_TIER_ORDER: Tier[] = ["High", "Medium", "Low", "Avoid"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ moverTier?: string }>;
}) {
  // Marketing-landing gate (THS-84): unauthenticated visitors to "/" see
  // the paid-beta wedge; authed users get the dashboard below. The
  // ConditionalShell sibling suppresses the operator Shell on the
  // unauthed branch so the landing renders fullscreen without sidebar.
  const sb = await getSupabaseServer();
  const auth = sb ? await sb.auth.getUser() : { data: { user: null } };
  if (!auth.data?.user) {
    return <MarketingLanding />;
  }

  // Parallel fetch — four independent server queries. MorningBrief was
  // moved off the Dashboard canvas (S8 redesign — Linear "calmer" principles);
  // its data surfaces on /memos when that page graduates from placeholder.
  const [snap, portfolio, regime, recentInsider] = await Promise.all([
    getDashboardSnapshot(),
    getPortfolioSnapshot(),
    getRegimeSnapshot(),
    getRecentInsider(),
  ]);
  const { greeting, dateLabel, marketLabel } = computeGreeting();
  const highTier = snap.tiers.find((t) => t.tier === "High");
  const allMovers = unifyMovers(snap.topWinners, snap.topLosers);

  // Mini-Insights filter state (task #77). Tier filter scopes the Score
  // Movers table to a single tier; chart aggregates always run on the full
  // movers set so bar heights stay stable when the filter is applied
  // (matches Universe Insights rail contract from S9).
  const params = await searchParams;
  const requestedTier = (params.moverTier ?? "").trim();
  const activeMoverTier: Tier | null = (RAIL_TIER_ORDER as string[]).includes(requestedTier)
    ? (requestedTier as Tier)
    : null;
  const moverTierCounts: Record<Tier, number> = {
    High: 0,
    Medium: 0,
    Low: 0,
    Avoid: 0,
  };
  for (const m of allMovers) {
    if (m.tier) moverTierCounts[m.tier] += 1;
  }
  const movers = activeMoverTier ? allMovers.filter((m) => m.tier === activeMoverTier) : allMovers;

  // Right-rail payload per spec §6. Derive per-gauge hit state from the
  // latest regime row using the same thresholds as composite.ts.
  const latest = regime.latest;
  const gateState: Record<GaugeKey, boolean> = {
    naaim: latest?.naaim != null && latest.naaim > 90,
    aaii_3wk_spread: latest?.aaii_3wk_spread != null && latest.aaii_3wk_spread > 30,
    fear_greed: latest?.fear_greed != null && latest.fear_greed > 80,
  };
  const railData = {
    movers,
    macroGatesHit: snap.macroGatesHit,
    macroMultiplier: snap.macroMultiplier,
    gateState,
    recentInsider,
    asOf: snap.asOf,
    synthetic: snap.synthetic,
    moverTierCounts,
    activeMoverTier,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <DashboardRailRegister data={railData} />
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 32px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {/*
          Dashboard v3 — S9 redesign per docs/design/insights-primitive-and-dashboard.md
          §6 Q-DASH-7..11 LOCKED. EngineStateStrip dropped (Terry S9: "If thats
          it I didnt like it"); engine-state info absorbed into the 5th KPI tile
          (MACRO MULTIPLIER). Composition:

            1. Greeting                   — operator anchor
            2. 5-KPI row                  — PORTFOLIO / P&L / 30D / MACRO MULT / HIGH-TIER
            3. PORTFOLIO VALUE chart      — line chart in card with range pills
            4. Score movers               — rows on canvas (Strip role)
            5. Top positions              — rows on canvas (Strip role)

          KPI sparklines retired 2026-05-19 (Terry): the tiny canvas made tame
          fluctuations look dramatic AND created vertical-rhythm asymmetry against
          KPIs that didn't carry a sparkline. The NAV chart below the KPI row is
          the canonical trend surface; tiles are scalar.
        */}
        <GreetingStrip
          initialGreeting={greeting}
          initialDateLabel={dateLabel}
          initialMarketLabel={marketLabel}
        />

        <KpiRow
          highCurrent={highTier?.current ?? 0}
          highPrior={highTier?.prior ?? 0}
          universeSize={snap.universeSize}
          portfolioValue={portfolio.total_market_value}
          portfolioPl={portfolio.total_pl}
          portfolioPlPct={portfolio.total_pl_pct}
          portfolioEmpty={portfolio.empty}
          macroMultiplier={snap.macroMultiplier}
          macroGatesHit={snap.macroGatesHit}
        />

        <PortfolioValueChart
          currentValue={portfolio.total_market_value}
          costBasis={portfolio.total_deployed}
          empty={portfolio.empty}
          synthetic={portfolio.synthetic_prices}
        />

        <Section
          label={
            activeMoverTier
              ? `Score movers · last 7 days · ${activeMoverTier} tier only`
              : "Score movers · last 7 days"
          }
          right={
            activeMoverTier ? (
              <Link
                href="/"
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  textDecoration: "none",
                  fontFamily: "var(--m)",
                }}
              >
                Clear filter ✕
              </Link>
            ) : (
              <Link
                href="/universe"
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  textDecoration: "none",
                  fontFamily: "var(--m)",
                }}
              >
                View all ›
              </Link>
            )
          }
        >
          {movers.length === 0 ? (
            <Empty>
              {activeMoverTier
                ? `No ${activeMoverTier}-tier names in this week's score movers.`
                : "No composite movement this week."}
            </Empty>
          ) : (
            <MoversTable movers={movers} asOf={snap.asOf} />
          )}
        </Section>

        <Section
          label="Top positions · by market value"
          right={
            portfolio.positions.length > 0 ? (
              <Link
                href="/portfolio"
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  textDecoration: "none",
                  fontFamily: "var(--m)",
                }}
              >
                Open book ›
              </Link>
            ) : undefined
          }
        >
          <TopPositionsList
            positions={portfolio.positions}
            scoresByTicker={snap.scoresByTicker}
            totalCapital={portfolio.settings.total_capital}
          />
        </Section>
      </div>
    </div>
  );
}

/* ---------------- KPI row (spec §4.4) ---------------- */

function KpiRow({
  highCurrent,
  highPrior,
  universeSize,
  portfolioValue,
  portfolioPl,
  portfolioPlPct,
  portfolioEmpty,
  macroMultiplier,
  macroGatesHit,
}: {
  highCurrent: number;
  highPrior: number;
  universeSize: number;
  portfolioValue: number;
  portfolioPl: number;
  portfolioPlPct: number;
  portfolioEmpty: boolean;
  macroMultiplier: number;
  macroGatesHit: number;
}) {
  const highDelta = highCurrent - highPrior;
  const highDeltaLabel =
    highDelta === 0
      ? "no change vs last week"
      : `${highDelta > 0 ? "↑" : "↓"} ${Math.abs(highDelta)} vs last week`;
  const plPos = portfolioPl >= 0;
  const plPctLabel = `${plPos ? "+" : ""}${(portfolioPlPct * 100).toFixed(2)}%`;
  const macroState =
    macroGatesHit >= 3
      ? { label: "Defensive", color: "var(--danger)" }
      : macroGatesHit === 2
      ? { label: "Cautious", color: "var(--warning)" }
      : macroGatesHit === 1
      ? { label: "Tightened", color: "var(--warning)" }
      : { label: "Neutral", color: "var(--success)" };

  // Empty-state variant: collapse Portfolio/P&L/30D into a single onboarding
  // card; keep Macro Multiplier + High-tier Names as their own tiles. Three
  // em-dashes reads as broken data — explicit onboarding CTA reads as
  // "this is where you start."
  if (portfolioEmpty) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3fr 1fr 1fr",
          gap: 32,
          padding: "4px 0",
        }}
      >
        <OnboardingCard />
        <KpiCell
          label="Macro multiplier"
          value={`${macroMultiplier.toFixed(2)}×`}
          sub={`${macroState.label} · ${macroGatesHit}/3 gates`}
          valueColor={macroState.color}
        />
        <KpiCell
          label="High-tier names"
          value={`${highCurrent}`}
          sub={`${highCurrent} of ${universeSize} scored · ${highDeltaLabel}`}
          valueColor="var(--text-1)"
        />
      </div>
    );
  }

  return (
    <div
      style={{
        // Mercury / Basis Rent-Roll pattern: 5 protagonist cells, no
        // vertical dividers, no top/bottom hairlines, whitespace as the
        // separator (Terry: "clean up the vertical and horizontal lines
        // around the 5 numbers"). Each cell carries its own rhythm and
        // earns its space without competing for chrome.
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 32,
        padding: "4px 0",
      }}
    >
      <AnimatedKpiCell
        label="Portfolio"
        value={portfolioValue}
        kind="usd"
        sub="market value"
      />
      <AnimatedKpiCell
        label="P&L · since open"
        value={portfolioPl}
        kind="usd-signed"
        sub={`${plPctLabel} on cost basis`}
        valueColor={plPos ? "var(--success)" : "var(--danger)"}
      />
      <KpiCell
        label="30D return"
        value="—"
        sub="tracks once positions have ≥30d of history"
        muted
      />
      <AnimatedKpiCell
        label="Macro multiplier"
        value={macroMultiplier}
        kind="multiplier"
        decimals={2}
        sub={`${macroState.label} · ${macroGatesHit}/3 gates`}
        valueColor={macroState.color}
      />
      <AnimatedKpiCell
        label="High-tier names"
        value={highCurrent}
        kind="int"
        sub={`${highCurrent}/${universeSize} · ${highDeltaLabel}`}
        valueColor="var(--text-1)"
      />
    </div>
  );
}

/**
 * Onboarding card shown in place of Portfolio/P&L/30D tiles when the
 * portfolio is empty. Two CTAs: "Add position" → /portfolio, "Import CSV"
 * → /portfolio (CSV importer surfaces there).
 */
function OnboardingCard() {
  return (
    <div
      style={{
        padding: "0",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}
      >
        Set up your book
      </span>
      <span
        style={{
          fontFamily: "var(--f)",
          fontSize: 15,
          color: "var(--text-1)",
          lineHeight: 1.45,
          maxWidth: 540,
        }}
      >
        Add your first position to start tracking market value, P&L, and
        30-day return against benchmarks.
      </span>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <Link
          href="/portfolio"
          style={{
            fontSize: 12,
            fontFamily: "var(--m)",
            color: "var(--text-1)",
            background: "var(--accent)",
            padding: "6px 14px",
            borderRadius: 4,
            textDecoration: "none",
            letterSpacing: ".02em",
          }}
        >
          + Add position
        </Link>
        <Link
          href="/portfolio?import=csv"
          style={{
            fontSize: 12,
            fontFamily: "var(--m)",
            color: "var(--text-2)",
            border: "1px solid var(--border)",
            padding: "6px 14px",
            borderRadius: 4,
            textDecoration: "none",
            letterSpacing: ".02em",
          }}
        >
          Import CSV
        </Link>
      </div>
    </div>
  );
}

function fmtUsd(n: number, signed = false): string {
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return `${sign}$${body}`;
}

function KpiCell({
  label,
  value,
  sub,
  valueColor,
  muted = false,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 7,
        minWidth: 0,
      }}
    >
      <span style={kpiLabelStyle()}>{label}</span>
      <span style={kpiValueStyle(muted ? "var(--text-4)" : (valueColor ?? "var(--text-1)"))}>
        {value}
      </span>
      {sub && <span style={kpiSubStyle()}>{sub}</span>}
    </div>
  );
}

/**
 * Animated sibling — count-up on mount + on revalidate. Uses the kind-based
 * AnimateNumber API so the prop boundary stays serializable (this page is
 * a Server Component). Same style scaffold as KpiCell — only the value
 * span swaps to AnimateNumber.
 */
function AnimatedKpiCell({
  label,
  value,
  kind,
  decimals,
  sub,
  valueColor,
}: {
  label: string;
  value: number;
  kind: AnimateNumberKind;
  decimals?: number;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 7,
        minWidth: 0,
      }}
    >
      <span style={kpiLabelStyle()}>{label}</span>
      <AnimateNumber
        value={value}
        kind={kind}
        decimals={decimals}
        style={kpiValueStyle(valueColor ?? "var(--text-1)")}
      />
      {sub && <span style={kpiSubStyle()}>{sub}</span>}
    </div>
  );
}

function kpiLabelStyle(): React.CSSProperties {
  return {
    fontSize: 10.5,
    fontFamily: "var(--m)",
    color: "var(--text-3)",
    letterSpacing: ".08em",
    textTransform: "uppercase",
  };
}

function kpiValueStyle(color: string): React.CSSProperties {
  return {
    fontFamily: "var(--m)",
    fontSize: 22,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color,
    lineHeight: 1,
  };
}

function kpiSubStyle(): React.CSSProperties {
  return { fontSize: 11, fontFamily: "var(--m)", color: "var(--text-3)" };
}

/* ---------------- unified Score movers ---------------- */

function unifyMovers(winners: DashboardMover[], losers: DashboardMover[]): DashboardMover[] {
  return [...winners, ...losers]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, SCORE_MOVERS_LIMIT);
}

/**
 * Grid-row movers list. Restructured from <table> so the whole row can
 * be a single <Link> — Linear discipline: any row whose content is the
 * detail page for a record is itself the navigation surface.
 *
 * Grid template:
 *   [ticker 92px][layer 1fr][composite 96px][Δ7D 80px][driver 110px]
 */
const MOVERS_GRID = "92px minmax(0, 1fr) 96px 80px 110px";

function MoversTable({ movers, asOf }: { movers: DashboardMover[]; asOf: string | null }) {
  return (
    <div style={{ fontSize: 13, fontFamily: "var(--m)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: MOVERS_GRID,
          columnGap: 16,
          padding: "0 14px 10px",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          color: "var(--text-3)",
          fontWeight: 500,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <span>Ticker</span>
        <span>Layer</span>
        <span style={{ textAlign: "right" }}>Composite</span>
        <span style={{ textAlign: "right" }}>Δ 7D</span>
        <span>Driver</span>
      </div>
      <div>
        {movers.map((m, i) => (
          <MoverRow key={m.ticker} m={m} isLast={i === movers.length - 1} asOf={asOf} rowIndex={i} />
        ))}
      </div>
    </div>
  );
}

function MoverRow({ m, isLast, asOf, rowIndex }: { m: DashboardMover; isLast: boolean; asOf: string | null; rowIndex: number }) {
  const dir = m.delta > 0 ? "↑" : m.delta < 0 ? "↓" : "→";
  const dirColor = m.delta > 0 ? "var(--success)" : m.delta < 0 ? "var(--danger)" : "var(--text-3)";
  // Pull full row from snap.rows for ScoreMath inputs (q/g/v/aiq are on the
  // UniverseRow shape but not propagated through DashboardMover by design —
  // composite already encodes the weighted sum, the popover re-derives for
  // transparency).
  const scoreMathInput: ScoreMathInput = {
    ticker: m.ticker,
    layer: m.layer ?? 0,
    layerLabel: m.layer_label,
    q: m.q,
    g: m.g,
    v: m.v,
    aiq: m.aiq,
    composite: m.composite,
    finalScore: m.final_score,
    macroGatesHit: m.macroGatesHit,
    macroMultiplier: m.macroMultiplier,
    asOf,
  };
  // Full-row click → /universe/{ticker}. ScoreMathPopover's trigger calls
  // both preventDefault + stopPropagation so clicking the composite cell
  // opens the popover instead of navigating. Linear-class affordance: the
  // whole row is the navigation surface (no hunt for the ticker hot-zone).
  return (
    <Link
      href={`/universe/${m.ticker}`}
      aria-label={`Open ${m.ticker} detail`}
      className="row-hov row-stagger-in"
      style={{
        display: "grid",
        gridTemplateColumns: MOVERS_GRID,
        columnGap: 16,
        padding: "10px 14px",
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
        alignItems: "baseline",
        textDecoration: "none",
        color: "inherit",
        // Cascade index for .row-stagger-in animation-delay calc.
        ["--row-i" as never]: Math.min(rowIndex, 12),
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{m.ticker}</span>
      <span style={{ color: "var(--text-3)", fontSize: 11 }}>{m.layer_label}</span>
      <ScoreMathPopover input={scoreMathInput}>
        <span
          style={{
            color: "var(--text-1)",
            fontVariantNumeric: "tabular-nums",
            display: "inline-block",
            textAlign: "right",
            width: "100%",
            borderBottom: "1px dotted transparent",
            transition: "border-color var(--dur-instant) var(--ease-out)",
          }}
          className="score-math-number"
        >
          {m.final_score == null ? "—" : m.final_score.toFixed(1)}{" "}
          <span style={{ color: dirColor }}>{dir}</span>
        </span>
      </ScoreMathPopover>
      <span style={{ color: dirColor, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {m.delta > 0 ? "+" : ""}{m.delta.toFixed(1)}
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {m.driver == null ? (
          <span style={{ color: "var(--text-4)" }}>—</span>
        ) : (
          <>
            <span style={{ color: "var(--text-2)" }}>{m.driver.factor}</span>{" "}
            <span style={{ color: m.driver.delta > 0 ? "var(--success)" : "var(--danger)" }}>
              {m.driver.delta > 0 ? "+" : ""}{m.driver.delta.toFixed(1)}
            </span>
          </>
        )}
      </span>
    </Link>
  );
}

/* ---------------- shared chrome ---------------- */

// Regime state classifier was inlined into KpiRow when EngineStateStrip
// retired S9 (Q-DASH-4 revised). If a second surface needs the same
// 0/1/2/3-gate → label/color mapping, hoist back to a shared helper.

function Section({
  label,
  children,
  right,
}: {
  label: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  // Mercury "format on canvas" (Pic 12 b2): no card wrapper. Header label
  // anchors the section with a hairline under it; content flows below.
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          paddingBottom: 10,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            color: "var(--text-3)",
            fontFamily: "var(--m)",
          }}
        >
          {label}
        </div>
        {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "var(--text-3)" }}>{children}</div>;
}

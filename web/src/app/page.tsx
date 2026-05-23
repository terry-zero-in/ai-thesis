import { getDashboardSnapshot, getRecentInsider, getInsider24h, type DashboardMover } from "@/lib/dashboard-data";
import type { Tier } from "@/lib/universe-data";
import { getLatestUniverseScoresServer } from "@/lib/universe-data-server";
import { getPortfolioSnapshot } from "@/lib/portfolio-data";
import { getRegimeSnapshot } from "@/lib/regime-data";
import { type GaugeKey } from "@/lib/regime-types";
import { getLatestMacroLog } from "@/lib/routine-outputs";
import { getAlertsSnapshot } from "@/lib/alerts-data";
import { getHighestDeprecRiskHyperscalerHeld } from "@/lib/depreciation-data";
import { DashboardRailRegister } from "@/components/rails/DashboardRailRegister";
import Link from "next/link";
import { GreetingStrip } from "@/app/GreetingStrip";
import { computeGreeting } from "@/app/greeting-compute";
import { PortfolioValueChart } from "@/components/dashboard/PortfolioValueChart";
import { TopPositionsList } from "@/components/dashboard/TopPositionsList";
import { TodayThesisCard, deriveBiasLayers } from "@/components/dashboard/TodayThesisCard";
import { ScoreMathPopover } from "@/components/primitives/ScoreMathPopover";
import { EngineStatusStripAsync } from "@/components/primitives/EngineStatusStripAsync";
import type { ScoreMathInput } from "@/components/primitives/ScoreMath";
import { AnimateNumber, type AnimateNumberKind } from "@/components/primitives/AnimateNumber";
// THS-84 marketing-landing gate temporarily disabled per Terry 2026-05-21
// ("hide the landing page for now"). To restore: re-add the two imports
// below and uncomment the auth-gate block inside DashboardPage().
// import { getSupabaseServer } from "@/lib/supabase/server";
// import { MarketingLanding } from "@/components/marketing/MarketingLanding";

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
  // THS-84 marketing-landing gate temporarily disabled per Terry 2026-05-21.
  // To restore, uncomment the block below and the two imports at the top.
  // const sb = await getSupabaseServer();
  // const auth = sb ? await sb.auth.getUser() : { data: { user: null } };
  // if (!auth.data?.user) {
  //   return <MarketingLanding />;
  // }

  // Parallel fetch — independent server queries. MorningBrief was moved
  // off the Dashboard canvas (S8 redesign — Linear "calmer" principles);
  // its data surfaces on /memos when that page graduates from placeholder.
  //
  // THS-74: added macroLog, alerts, insider24h, and universe-server for
  // the "Today's Thesis" command-center module + the right-rail rework.
  const [snap, portfolio, regime, recentInsider, insider24h, macroLog, alerts, universe] = await Promise.all([
    getDashboardSnapshot(),
    getPortfolioSnapshot(),
    getRegimeSnapshot(),
    getRecentInsider(),
    getInsider24h(),
    getLatestMacroLog(),
    getAlertsSnapshot(),
    getLatestUniverseScoresServer(),
  ]);
  const heldTickers = portfolio.positions.map((p) => p.ticker);
  const highestDeprec = await getHighestDeprecRiskHyperscalerHeld(heldTickers);
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
    insider24h,
    asOf: snap.asOf,
    synthetic: snap.synthetic,
    moverTierCounts,
    activeMoverTier,
  };

  // THS-74 — Today's Thesis card derivations.
  //
  // Posture: deployed % = market_value / total_capital, reserve = remainder.
  // We bound both to [0, 100] so a market drawdown that pushes deployed
  // briefly past 100% (or a settings reset that pushes reserve negative)
  // still renders without nonsense. The KPI tiles below show the raw
  // numbers; this card is the headline.
  const totalCapital = portfolio.settings.total_capital;
  const deployedPctRaw = totalCapital > 0 ? (portfolio.total_market_value / totalCapital) * 100 : 0;
  const deployedPct = Math.round(Math.max(0, Math.min(100, deployedPctRaw)));
  const reservePct = Math.max(0, 100 - deployedPct);
  const positionsCount = portfolio.positions.length;

  const bias = {
    ...deriveBiasLayers(portfolio.positions, universe.rows),
    highestDeprecHyperscaler: highestDeprec,
  };

  // Watchlist pressure: High-tier names in scores not yet held. Source
  // of truth is universe.rows[].tier — `tier` lives on scores_history,
  // joined into UniverseRow via buildSnapshot.
  const heldSet = new Set(heldTickers);
  const highTierTickers = universe.rows.filter((r) => r.tier === "High");
  const watchlistPressure = {
    notHeld: highTierTickers.filter((r) => !heldSet.has(r.ticker)).length,
    noHighTier: highTierTickers.length === 0,
  };

  // Action: pick the lead unacked event kind by recency, count its peers
  // (so the row text reads "Review N insider-cluster alerts" with N being
  // the same-kind cohort, not the global unread count).
  const unacked = alerts.events.filter((e) => !e.acked_at);
  const leadEvent = unacked[0] ?? null; // events are sorted as_of desc
  const leadKind = leadEvent?.kind ?? null;
  const leadKindCount = leadKind ? unacked.filter((e) => e.kind === leadKind).length : 0;

  const nowLabel = formatNycClock();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <DashboardRailRegister data={railData} />
      <EngineStatusStripAsync />
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

        {/*
          THS-74 — "Today's Thesis" command-center module. Five-row hero
          card sitting between the greeting + EngineStatusStrip and the
          KPI tiles. Reads as the engine's daily morning briefing in one
          scan: macro state, portfolio posture, current bias, watchlist
          pressure, and required action.
        */}
        <TodayThesisCard
          macro={macroLog}
          bias={bias}
          posture={{
            deployedPct,
            reservePct,
            positionsCount,
            empty: portfolio.empty,
          }}
          watchlistPressure={watchlistPressure}
          action={{
            unseenCount: alerts.unseen,
            leadKind,
            leadKindCount,
          }}
          nowLabel={nowLabel}
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
        />

        <Section
          label={
            activeMoverTier
              ? `Score movers · last 7 days · ${activeMoverTier} tier only`
              : "Score movers · last 7 days"
          }
          right={
            activeMoverTier ? (
              <Link href="/" className="accent-link" style={{ fontSize: 11 }}>
                Clear filter <span className="accent-link-chev">✕</span>
              </Link>
            ) : (
              <Link href="/universe" className="accent-link" style={{ fontSize: 11 }}>
                View all <span className="accent-link-chev">›</span>
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
              <Link href="/portfolio" className="accent-link" style={{ fontSize: 11 }}>
                Open book <span className="accent-link-chev">›</span>
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
  // "this is where you start." Hairlines between cells match the populated
  // variant so the empty state preserves the same rhythm.
  if (portfolioEmpty) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3fr 1fr 1fr",
          gap: 0,
          padding: "4px 0",
        }}
      >
        <KpiSlot first><OnboardingCard /></KpiSlot>
        <KpiSlot href="/regime">
          <KpiCell
            label="Macro multiplier"
            value={`${macroMultiplier.toFixed(2)}×`}
            sub={`${macroState.label} · ${macroGatesHit}/3 gates`}
            valueColor={macroState.color}
          />
        </KpiSlot>
        <KpiSlot last href="/universe?tier=High">
          <KpiCell
            label="High-tier names"
            value={`${highCurrent}`}
            sub={`${highCurrent} of ${universeSize} scored · ${highDeltaLabel}`}
            valueColor="var(--text-1)"
          />
        </KpiSlot>
      </div>
    );
  }

  return (
    <div
      style={{
        // 5 protagonist cells with vertical hairline separators per Terry
        // 2026-05-20 ("not tiles… vertical line to separate them in between
        // each"). Hairline lives on the right edge of cells 1–4; each cell
        // pads 24px on each side of the line so breathing is symmetric.
        // Cells stay chromeless (no card, no top/bottom border) — only the
        // verticals.
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 0,
        padding: "4px 0",
      }}
    >
      <KpiSlot first href="/portfolio">
        <AnimatedKpiCell
          label="Portfolio"
          value={portfolioValue}
          kind="usd"
          sub="market value"
        />
      </KpiSlot>
      <KpiSlot href="/portfolio">
        <AnimatedKpiCell
          label="P&L · since open"
          value={portfolioPl}
          kind="usd-signed"
          sub={`${plPctLabel} on cost basis`}
          valueColor={plPos ? "var(--success)" : "var(--danger)"}
        />
      </KpiSlot>
      <KpiSlot href="/portfolio">
        <KpiCell
          label="30D return"
          value="—"
          sub="tracks once positions have ≥30d of history"
          muted
        />
      </KpiSlot>
      <KpiSlot href="/regime">
        <AnimatedKpiCell
          label="Macro multiplier"
          value={macroMultiplier}
          kind="multiplier"
          decimals={2}
          sub={`${macroState.label} · ${macroGatesHit}/3 gates`}
          valueColor={macroState.color}
        />
      </KpiSlot>
      <KpiSlot last href="/universe?tier=High">
        <AnimatedKpiCell
          label="High-tier names"
          value={highCurrent}
          kind="int"
          sub={`${highCurrent}/${universeSize} · ${highDeltaLabel}`}
          valueColor="var(--text-1)"
        />
      </KpiSlot>
    </div>
  );
}

/**
 * KPI grid cell slot — adds the vertical hairline divider to cells 1..n-1
 * and pads each side of the hairline 24px so cell content breathes
 * symmetrically. `first` cell drops left padding (flush to canvas edge);
 * `last` cell drops right padding and the trailing hairline.
 *
 * When `href` is passed (Terry 2026-05-20 — "should all be click through
 * items"), inner content wraps in a Link with .kpi-hov: subtle --hover-tint
 * bg fill with 6px rounded corners on hover, extending outward via negative
 * margin so the pill fills the cell content area without overlapping the
 * neighbouring hairline.
 */
function KpiSlot({
  children,
  first,
  last,
  href,
}: {
  children: React.ReactNode;
  first?: boolean;
  last?: boolean;
  href?: string;
}) {
  const innerPad = "10px 12px";
  const innerNegMargin = "-10px -12px";
  const inner = href ? (
    <Link
      href={href}
      className="kpi-hov"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        padding: innerPad,
        margin: innerNegMargin,
        color: "inherit",
        textDecoration: "none",
        minWidth: 0,
      }}
    >
      {children}
    </Link>
  ) : (
    children
  );
  return (
    <div
      style={{
        padding: first ? "0 24px 0 0" : last ? "0 0 0 24px" : "0 24px",
        borderRight: last ? undefined : "1px solid var(--border-subtle)",
        minWidth: 0,
      }}
    >
      {inner}
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
        gateKey="dashboard-kpis-animated-v1"
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

/**
 * Clock label for the Today's Thesis card header (THS-74).
 * Format: "Mon May 18 · 9:34 AM CT" — spec verbatim. Rendered server-side
 * so the value is stable across the page revalidate window (every 30
 * minutes). The GreetingStrip wall clock already carries the
 * second-precision live ticker.
 *
 * Note on the TZ suffix: spec literal example shows "CT" while the
 * preamble text says "NYC time." These contradict — followed the literal
 * example (CT = Terry's wall-clock TZ, matching the rest of the
 * dashboard chrome from greeting-compute.ts which also renders Chicago
 * time). The date portion (Mon May 18) is the same in both zones for the
 * vast majority of the day, so the practical difference is small.
 */
function formatNycClock(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayPart = `${get("weekday")} ${get("month")} ${get("day")}`;
  const timePart = `${get("hour")}:${get("minute")} ${get("dayPeriod")} CT`;
  return `${dayPart} · ${timePart}`;
}

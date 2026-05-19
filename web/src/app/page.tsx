import { getDashboardSnapshot, getRecentInsider, type DashboardMover } from "@/lib/dashboard-data";
import { getPortfolioSnapshot } from "@/lib/portfolio-data";
import { getRegimeSnapshot } from "@/lib/regime-data";
import { type GaugeKey } from "@/lib/regime-types";
import { DashboardRailRegister } from "@/components/rails/DashboardRailRegister";
import Link from "next/link";
import { GreetingStrip } from "@/app/GreetingStrip";
import { computeGreeting } from "@/app/greeting-compute";
import { EngineStateStrip } from "@/components/dashboard/EngineStateStrip";
import { ScoreMathPopover } from "@/components/primitives/ScoreMathPopover";
import type { ScoreMathInput } from "@/components/primitives/ScoreMath";
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
  High: "var(--accent)",
  Medium: "var(--warning)",
  Low: "var(--info)",
  Avoid: "var(--danger)",
};

/** Unified movers limit shown on dashboard table — top abs(Δ7D). */
const SCORE_MOVERS_LIMIT = 8;

export default async function DashboardPage() {
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
  const movers = unifyMovers(snap.topWinners, snap.topLosers);

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
          gap: 32,
        }}
      >
        {/*
          Dashboard consolidation S8 — per docs/design/insights-primitive-and-dashboard.md
          and Linear "calmer interface" principles Terry shared (don't compete
          for attention you haven't earned, structure felt not seen, less is
          more). The canvas is FOUR sections, scannable in 10 seconds, one
          viewport at 1440px tall:

            1. Greeting               — operator anchor
            2. Engine state strip     — merges MonoMetaSpine + AlertCallout
            3. KPI row                — four numbers
            4. Score movers           — canvas anchor

          DROPPED from canvas (per /lambo signature-pattern doctrine — these
          were bespoke surfaces that duplicated info elsewhere):
            - TodayThesisCard         (duplicates spine + alert + KPI)
            - MorningBrief            (moves to /memos when that page lifts)
            - CompactGateStrip        (right rail's MACRO GATES is canonical)

          The AlertCallout (when gates>0) is now an inline severity-toned
          segment on EngineStateStrip with a single "▶ Review regime" link.
          No more scattered "Open regime ›" links across multiple cards.
        */}
        <GreetingStrip
          initialGreeting={greeting}
          initialDateLabel={dateLabel}
          initialMarketLabel={marketLabel}
        />

        <EngineStateStrip
          asOf={snap.asOf}
          synthetic={snap.synthetic}
          macroGatesHit={snap.macroGatesHit}
          macroMultiplier={snap.macroMultiplier}
          regimeState={regimeStateFor(snap.macroGatesHit, snap.macroMultiplier)}
        />

        <KpiRow
          highCurrent={highTier?.current ?? 0}
          highPrior={highTier?.prior ?? 0}
          universeSize={snap.universeSize}
          portfolioValue={portfolio.total_market_value}
          portfolioPl={portfolio.total_pl}
          portfolioPlPct={portfolio.total_pl_pct}
          portfolioEmpty={portfolio.empty}
        />

        <Section
          label="Score movers · last 7 days"
          right={
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
          }
        >
          {movers.length === 0 ? (
            <Empty>No composite movement this week.</Empty>
          ) : (
            <MoversTable movers={movers} asOf={snap.asOf} />
          )}
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
}: {
  highCurrent: number;
  highPrior: number;
  universeSize: number;
  portfolioValue: number;
  portfolioPl: number;
  portfolioPlPct: number;
  portfolioEmpty: boolean;
}) {
  const highDelta = highCurrent - highPrior;
  const highDeltaLabel =
    highDelta === 0
      ? "no change vs last week"
      : `${highDelta > 0 ? "↑" : "↓"} ${Math.abs(highDelta)} vs last week`;
  const plPos = portfolioPl >= 0;
  const plPctLabel = `${plPos ? "+" : ""}${(portfolioPlPct * 100).toFixed(2)}%`;

  // Empty-state variant per /lambo D2: collapse Portfolio/P&L/30D into a
  // single onboarding card spanning 3 columns; keep High-tier names as
  // its own tile. Three em-dashes in a row reads as "data is broken" — an
  // explicit onboarding CTA reads as "this is where you start."
  if (portfolioEmpty) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3fr 1fr",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <OnboardingCard />
        <KpiCell
          label="High-tier names"
          value={`${highCurrent}`}
          sub={`${highCurrent}/${universeSize} · ${highDeltaLabel}`}
          valueColor="var(--text-1)"
        />
      </div>
    );
  }

  return (
    <div
      style={{
        // Mercury KPI strip (Pic 17/19 b2): no outer chrome. Cells separated
        // by vertical hairlines only; the strip sits on the canvas.
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <KpiCell
        label="Portfolio"
        value={fmtUsd(portfolioValue)}
        sub="market value"
        isFirst
      />
      <KpiCell
        label="P&L · today"
        value={fmtUsd(portfolioPl, true)}
        sub={`${plPctLabel} since open`}
        valueColor={plPos ? "var(--success)" : "var(--danger)"}
      />
      <KpiCell
        label="30D return"
        value="—"
        sub="tracks once a position has been open ≥ 30 days"
        muted
      />
      <KpiCell
        label="High-tier names"
        value={`${highCurrent}`}
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
        padding: "18px 22px",
        borderRight: "1px solid var(--border-subtle)",
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
  isFirst = false,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  muted?: boolean;
  isFirst?: boolean;
}) {
  return (
    <div
      style={{
        padding: "18px 22px 18px",
        borderLeft: isFirst ? undefined : "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
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
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 24,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: muted ? "var(--text-4)" : (valueColor ?? "var(--text-1)"),
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 11, fontFamily: "var(--m)", color: "var(--text-3)" }}>{sub}</span>
      )}
    </div>
  );
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
          <MoverRow key={m.ticker} m={m} isLast={i === movers.length - 1} asOf={asOf} />
        ))}
      </div>
    </div>
  );
}

function MoverRow({ m, isLast, asOf }: { m: DashboardMover; isLast: boolean; asOf: string | null }) {
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
  return (
    <div
      className="row-hov"
      style={{
        display: "grid",
        gridTemplateColumns: MOVERS_GRID,
        columnGap: 16,
        padding: "10px 14px",
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
        alignItems: "baseline",
      }}
    >
      <Link
        href={`/universe/${m.ticker}`}
        aria-label={`Open ${m.ticker} detail`}
        style={{
          fontWeight: 600,
          color: "var(--text-1)",
          textDecoration: "none",
        }}
      >
        {m.ticker}
      </Link>
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
    </div>
  );
}

/* ---------------- regime state classifier ---------------- */

/**
 * Regime state derived from gate count. Names describe the CONSEQUENCE
 * (what happens to High-tier names) rather than the cause (which gauges
 * are firing) so the pill reads as an actionable status.
 *
 * 0 gates → Neutral · 1.00×       (success token — calm)
 * 1 gate  → Tightened · 0.95×     (warning — first signal)
 * 2 gates → Cautious · 0.90×      (warning — stronger)
 * 3 gates → Defensive · 0.85×     (danger — fully de-risked)
 */
function regimeStateFor(gatesHit: number, _multiplier: number): { label: string; color: string } {
  if (gatesHit >= 3) return { label: "Defensive", color: "var(--danger)" };
  if (gatesHit === 2) return { label: "Cautious", color: "var(--warning)" };
  if (gatesHit === 1) return { label: "Tightened", color: "var(--warning)" };
  return { label: "Neutral", color: "var(--success)" };
}


/* ---------------- shared chrome ---------------- */

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

import { getDashboardSnapshot, getRecentInsider, type DashboardMover } from "@/lib/dashboard-data";
import { getPortfolioSnapshot } from "@/lib/portfolio-data";
import { getRegimeSnapshot } from "@/lib/regime-data";
import { getMorningBrief } from "@/lib/routine-outputs";
import { GAUGES, type GaugeKey } from "@/lib/regime-types";
import { DashboardRailRegister } from "@/components/rails/DashboardRailRegister";
import { MorningBrief } from "@/components/dashboard/MorningBrief";
import { TodayThesisCard } from "@/components/dashboard/TodayThesisCard";
import Link from "next/link";
import { GreetingStrip } from "@/app/GreetingStrip";
import { computeGreeting } from "@/app/greeting-compute";
import { MonoMetaSpine } from "@/components/primitives/MonoMetaSpine";
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

  // Parallel fetch — five independent server queries.
  const [snap, portfolio, regime, recentInsider, morningBrief] = await Promise.all([
    getDashboardSnapshot(),
    getPortfolioSnapshot(),
    getRegimeSnapshot(),
    getRecentInsider(),
    getMorningBrief(),
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
        <GreetingStrip
          initialGreeting={greeting}
          initialDateLabel={dateLabel}
          initialMarketLabel={marketLabel}
        />

        <MonoMetaSpine
          segments={[
            { label: "as_of", value: snap.asOf ?? "—" },
            { label: "engine", value: "composite v1.0" },
            {
              label: "mode",
              value: (
                <span
                  style={{
                    color: snap.synthetic ? "var(--warning)" : "var(--success)",
                    fontWeight: 600,
                    letterSpacing: ".02em",
                  }}
                  title={
                    snap.synthetic
                      ? "Stubbed: synthesized fixture data — engine not yet running against a deployed Supabase project."
                      : "Live: scores read from public.scores_history populated by the Saturday chain."
                  }
                >
                  {snap.synthetic ? "Stubbed" : "Live"}
                </span>
              ),
            },
            { label: "macro", value: `${snap.macroMultiplier.toFixed(2)}× (${snap.macroGatesHit}/3)` },
            { label: "weekly chain", value: "Sat 22:00–22:45 UTC" },
          ]}
        />

        <TodayThesisCard
          snap={snap}
          movers={movers}
          regimeState={regimeStateFor(snap.macroGatesHit, snap.macroMultiplier)}
        />

        {snap.macroGatesHit > 0 && regime.latest && (
          <AlertCallout
            label="Macro regime"
            items={alertItemsFromRegime(snap, regime.latest)}
            gatesHit={snap.macroGatesHit}
            multiplier={snap.macroMultiplier}
          />
        )}

        {/* Morning brief (daily-batch routine output). Renders only when
            the routine has produced at least one of: insider summary,
            macro log, or pending memo proposals. Invisible pre-Routines. */}
        <MorningBrief data={morningBrief} />

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

        <Section
          label="Regime · macro gate state"
          right={
            <Link
              href="/regime"
              style={{
                fontSize: 11,
                color: "var(--accent)",
                textDecoration: "none",
                fontFamily: "var(--m)",
              }}
            >
              Open regime ›
            </Link>
          }
        >
          <CompactGateStrip regime={regime} gatesHit={snap.macroGatesHit} multiplier={snap.macroMultiplier} />
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

/* ---------------- Alert Summary callout (Mercury Pic 11 b2) ---------------- */

interface AlertItem {
  notable: string;
  action: { label: string; href: string };
}

function alertItemsFromRegime(
  snap: { macroGatesHit: number },
  latest: { naaim: number | null; aaii_3wk_spread: number | null; fear_greed: number | null }
): AlertItem[] {
  const items: AlertItem[] = [];
  if (latest.naaim != null && latest.naaim > 90) {
    items.push({
      notable: `NAAIM exposure at ${latest.naaim.toFixed(1)} — above ${GAUGES.find((g) => g.key === "naaim")?.threshold ?? 90} gate threshold`,
      action: { label: "Review regime gauges", href: "/regime" },
    });
  }
  if (latest.aaii_3wk_spread != null && latest.aaii_3wk_spread > 30) {
    items.push({
      notable: `AAII 3-wk bull-bear spread at +${latest.aaii_3wk_spread.toFixed(1)} — above +30 gate threshold`,
      action: { label: "Review regime gauges", href: "/regime" },
    });
  }
  if (latest.fear_greed != null && latest.fear_greed > 80) {
    items.push({
      notable: `CNN Fear & Greed at ${latest.fear_greed.toFixed(0)} — above 80 gate threshold`,
      action: { label: "Review regime gauges", href: "/regime" },
    });
  }
  if (items.length === 0 && snap.macroGatesHit > 0) {
    items.push({
      notable: `${snap.macroGatesHit} of 3 macro gates currently hit — high-conviction names tightened`,
      action: { label: "Review regime", href: "/regime" },
    });
  }
  return items;
}

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
function regimeStateFor(gatesHit: number, multiplier: number): { label: string; color: string } {
  if (gatesHit >= 3) return { label: "Defensive", color: "var(--danger)" };
  if (gatesHit === 2) return { label: "Cautious", color: "var(--warning)" };
  if (gatesHit === 1) return { label: "Tightened", color: "var(--warning)" };
  return { label: "Neutral", color: "var(--success)" };
}

function AlertCallout({
  label,
  items,
  gatesHit,
  multiplier,
}: {
  label: string;
  items: AlertItem[];
  gatesHit: number;
  multiplier: number;
}) {
  if (items.length === 0) return null;
  const state = regimeStateFor(gatesHit, multiplier);
  // Mercury Pic 11 b2 "Suggested actions": thin border, NO bg fill. Two-col
  // rows (notable left, hyperlinked action right). No card chrome.
  return (
    <div
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        padding: "14px 18px 4px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          paddingBottom: 8,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-1)",
            fontFamily: "var(--f)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontFamily: "var(--m)",
            color: state.color,
            border: `1px solid ${state.color}`,
            borderRadius: 999,
            padding: "1px 8px",
            letterSpacing: ".02em",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: state.color,
            }}
          />
          {state.label} · {multiplier.toFixed(2)}×
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              alignItems: "baseline",
              padding: "12px 0",
              borderBottom: i === items.length - 1 ? undefined : "1px solid var(--border-subtle)",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>{it.notable}</span>
            <a
              href={it.action.href}
              style={{
                fontSize: 12.5,
                color: "var(--accent)",
                textDecoration: "none",
                fontFamily: "var(--m)",
                whiteSpace: "nowrap",
              }}
            >
              {it.action.label} ›
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- compact macro gate strip ----------------
 *
 * Replaces three full GaugeCards (Dashboard duplicated /regime). Single
 * stacked row per gauge: dot · label · value/threshold · status. Bottom
 * line summarizes hit-count + multiplier. Recovers ~400px and removes
 * the "this looks like /regime again" sensation. Full cards live one
 * click away at /regime via the section's right-side link.
 */
function CompactGateStrip({
  regime,
  gatesHit,
  multiplier,
}: {
  regime: Awaited<ReturnType<typeof getRegimeSnapshot>>;
  gatesHit: number;
  multiplier: number;
}) {
  const latest = regime.latest;
  const state = regimeStateFor(gatesHit, multiplier);
  return (
    <div
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {GAUGES.map((g) => {
        const value = latest?.[g.key] ?? null;
        const hit = value != null && value > g.threshold;
        return (
          <CompactGateRow
            key={g.key}
            label={g.label}
            value={value}
            threshold={g.threshold}
            hit={hit}
          />
        );
      })}
      <div
        style={{
          marginTop: 4,
          paddingTop: 8,
          borderTop: "1px solid var(--border-subtle)",
          fontSize: 11,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>
          {gatesHit} of 3 gates hit · {multiplier.toFixed(2)}× multiplier on High tier
        </span>
        <span
          style={{
            marginLeft: "auto",
            color: state.color,
            letterSpacing: ".02em",
          }}
        >
          {state.label}
        </span>
      </div>
    </div>
  );
}

function CompactGateRow({
  label,
  value,
  threshold,
  hit,
}: {
  label: string;
  value: number | null;
  threshold: number;
  hit: boolean;
}) {
  const dotColor = hit ? "var(--warning)" : value == null ? "var(--text-4)" : "var(--text-3)";
  const valueLabel = value == null ? "—" : value.toFixed(value < 10 ? 1 : 0);
  let trailer: { text: string; color: string };
  if (value == null) {
    trailer = { text: "no data", color: "var(--text-4)" };
  } else if (hit) {
    const pts = Math.abs(value - threshold);
    trailer = { text: `▲ ${pts.toFixed(1)} pts over gate`, color: "var(--warning)" };
  } else {
    const pts = Math.abs(threshold - value);
    trailer = { text: `▼ ${pts.toFixed(1)} pts under gate`, color: "var(--text-3)" };
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "10px 1fr auto auto",
        gap: 10,
        alignItems: "baseline",
        fontFamily: "var(--m)",
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColor,
          alignSelf: "center",
        }}
      />
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          color: hit ? "var(--text-1)" : "var(--text-2)",
          minWidth: 64,
          textAlign: "right",
        }}
      >
        {valueLabel}
        <span style={{ color: "var(--text-4)" }}> / {threshold}</span>
      </span>
      <span style={{ fontSize: 11, color: trailer.color, whiteSpace: "nowrap" }}>{trailer.text}</span>
    </div>
  );
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

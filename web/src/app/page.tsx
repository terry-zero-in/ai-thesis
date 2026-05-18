import { getDashboardSnapshot, type DashboardMover } from "@/lib/dashboard-data";
import { getPortfolioSnapshot } from "@/lib/portfolio-data";
import { getRegimeSnapshot } from "@/lib/regime-data";
import { GAUGES, type GaugeKey } from "@/lib/regime-types";
import { GaugeCard } from "@/app/regime/GaugeCard";
import { DashboardRailRegister } from "@/components/rails/DashboardRailRegister";
import Link from "next/link";
import { GreetingStrip, getServerGreeting } from "@/app/GreetingStrip";
import { MonoMetaSpine } from "@/components/primitives/MonoMetaSpine";

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
  // Parallel fetch — three independent server queries.
  const [snap, portfolio, regime] = await Promise.all([
    getDashboardSnapshot(),
    getPortfolioSnapshot(),
    getRegimeSnapshot(),
  ]);
  const { greeting, dateLabel } = getServerGreeting();
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
        <GreetingStrip initialGreeting={greeting} initialDateLabel={dateLabel} />

        <MonoMetaSpine
          segments={[
            { label: "as_of", value: snap.asOf ?? "—" },
            { label: "engine", value: "composite v1.0" },
            { label: "macro", value: `${snap.macroMultiplier.toFixed(2)}× (${snap.macroGatesHit}/3)` },
            { label: "weekly chain", value: "Sat 22:00–22:45 UTC" },
          ]}
        />

        {snap.macroGatesHit > 0 && regime.latest && (
          <AlertCallout
            label="Macro regime"
            items={alertItemsFromRegime(snap, regime.latest)}
          />
        )}

        <KpiRow
          highCurrent={highTier?.current ?? 0}
          highPrior={highTier?.prior ?? 0}
          universeSize={snap.universeSize}
          portfolioValue={portfolio.total_market_value}
          portfolioPl={portfolio.total_pl}
          portfolioPlPct={portfolio.total_pl_pct}
          portfolioEmpty={portfolio.empty}
        />

        <Section label="Score movers · last 7 days">
          {movers.length === 0 ? (
            <Empty>No composite movement this week.</Empty>
          ) : (
            <MoversTable movers={movers} />
          )}
        </Section>

        <Section
          label="Regime · macro gate state"
          right={
            <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
              {snap.macroGatesHit} of 3 gates hit · {snap.macroMultiplier.toFixed(2)}× multiplier active on High tier
            </span>
          }
        >
          <GaugeRow regime={regime} />
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
    highDelta === 0 ? "no change wk/wk" : `${highDelta > 0 ? "+" : ""}${highDelta} wk/wk`;
  const plPos = portfolioPl >= 0;
  const plPctLabel = `${plPos ? "+" : ""}${(portfolioPlPct * 100).toFixed(2)}%`;
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
        value={portfolioEmpty ? "—" : fmtUsd(portfolioValue)}
        sub={portfolioEmpty ? "no positions yet · open /portfolio to add" : "market value"}
        muted={portfolioEmpty}
        isFirst
      />
      <KpiCell
        label="P&L"
        value={portfolioEmpty ? "—" : fmtUsd(portfolioPl, true)}
        sub={portfolioEmpty ? "no positions yet" : `${plPctLabel} since open`}
        valueColor={portfolioEmpty ? undefined : plPos ? "var(--success)" : "var(--danger)"}
        muted={portfolioEmpty}
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

function MoversTable({ movers }: { movers: DashboardMover[] }) {
  return (
    <div style={{ fontSize: 13, fontFamily: "var(--m)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: MOVERS_GRID,
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
          <MoverRow key={m.ticker} m={m} isLast={i === movers.length - 1} />
        ))}
      </div>
    </div>
  );
}

function MoverRow({ m, isLast }: { m: DashboardMover; isLast: boolean }) {
  const dir = m.delta > 0 ? "↑" : m.delta < 0 ? "↓" : "→";
  const dirColor = m.delta > 0 ? "var(--success)" : m.delta < 0 ? "var(--danger)" : "var(--text-3)";
  return (
    <Link
      href={`/universe/${m.ticker}`}
      aria-label={`Open ${m.ticker} detail`}
      className="row-hov"
      style={{
        display: "grid",
        gridTemplateColumns: MOVERS_GRID,
        padding: "10px 14px",
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
        color: "inherit",
        textDecoration: "none",
        alignItems: "baseline",
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{m.ticker}</span>
      <span style={{ color: "var(--text-3)", fontSize: 11 }}>{m.layer_label}</span>
      <span style={{ color: "var(--text-1)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {m.final_score == null ? "—" : m.final_score.toFixed(1)} <span style={{ color: dirColor }}>{dir}</span>
      </span>
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

function AlertCallout({ label, items }: { label: string; items: AlertItem[] }) {
  if (items.length === 0) return null;
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
        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
          {items.length} active alert{items.length === 1 ? "" : "s"}
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

/* ---------------- real gauge row (reuses /regime GaugeCard) ---------------- */

function GaugeRow({ regime }: { regime: Awaited<ReturnType<typeof getRegimeSnapshot>> }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 14,
      }}
    >
      {GAUGES.map((g) => (
        <GaugeCard
          key={g.key}
          gauge={g.key as GaugeKey}
          history={regime.history}
          thresholdHistory={regime.threshold_history[g.key as GaugeKey]}
        />
      ))}
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

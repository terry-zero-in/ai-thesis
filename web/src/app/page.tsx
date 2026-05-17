import { Fragment } from "react";
import { getDashboardSnapshot, type DashboardMover } from "@/lib/dashboard-data";

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
  const snap = await getDashboardSnapshot();
  const { greeting, dateLabel } = currentGreeting();
  const highTier = snap.tiers.find((t) => t.tier === "High");
  const movers = unifyMovers(snap.topWinners, snap.topLosers);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 28px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <GreetingStrip greeting={greeting} dateLabel={dateLabel} synthetic={snap.synthetic} />

        <KpiRow
          highCurrent={highTier?.current ?? 0}
          highPrior={highTier?.prior ?? 0}
          universeSize={snap.universeSize}
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
          <GaugeRowStub />
        </Section>
      </div>
    </div>
  );
}

/* ---------------- greeting + date ---------------- */

function currentGreeting(): { greeting: string; dateLabel: string } {
  // Server-rendered in America/Chicago per spec §5.1 mock ("23:24 CT").
  const tz = "America/Chicago";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = parseInt(get("hour"), 10);
  const greeting =
    hour >= 5 && hour < 12 ? "Good morning"
    : hour >= 12 && hour < 17 ? "Good afternoon"
    : "Good evening";
  const dateLabel = `${get("weekday")}, ${get("month")} ${get("day")}, ${get("year")}`;
  return { greeting, dateLabel };
}

function GreetingStrip({ greeting, dateLabel, synthetic }: { greeting: string; dateLabel: string; synthetic: boolean }) {
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        paddingBottom: 4,
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-.014em",
          color: "var(--text-1)",
          fontFamily: "var(--f)",
          lineHeight: 1.2,
        }}
      >
        {greeting}, Terry
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-3)", fontFamily: "var(--m)" }}>
        <span>{dateLabel}</span>
        {synthetic && <span style={{ color: "var(--text-3)" }}>· fixture mode</span>}
      </div>
    </header>
  );
}

/* ---------------- KPI row (spec §4.4) ---------------- */

function KpiRow({
  highCurrent,
  highPrior,
  universeSize,
}: {
  highCurrent: number;
  highPrior: number;
  universeSize: number;
}) {
  const highDelta = highCurrent - highPrior;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 1,
        background: "var(--border)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <KpiCell label="Portfolio" value="—" sub="portfolio adapter pending" muted />
      <KpiCell label="Day P&L" value="—" sub="portfolio adapter pending" muted />
      <KpiCell label="30D return" value="—" sub="portfolio adapter pending" muted />
      <KpiCell
        label="High-tier names"
        value={`${highCurrent}`}
        sub={`${highCurrent}/${universeSize} · ${highDelta > 0 ? "+" : highDelta < 0 ? "" : "·"}${highDelta !== 0 ? highDelta : ""} wk/wk`.trim()}
        valueColor="var(--text-1)"
      />
    </div>
  );
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
        padding: "14px 16px",
        background: "var(--surface-1)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
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

function MoversTable({ movers }: { movers: DashboardMover[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto auto",
        rowGap: 6,
        columnGap: 18,
        fontSize: 12.5,
        fontFamily: "var(--m)",
        alignItems: "baseline",
      }}
    >
      <MoversHeader />
      {movers.map((m) => (
        <MoverRow key={m.ticker} m={m} />
      ))}
    </div>
  );
}

function MoversHeader() {
  const th: React.CSSProperties = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    color: "var(--text-3)",
    fontWeight: 500,
    paddingBottom: 4,
    borderBottom: "1px solid var(--border-subtle)",
  };
  return (
    <>
      <span style={th}>Ticker</span>
      <span style={th}>Layer</span>
      <span style={{ ...th, textAlign: "right" }}>Composite</span>
      <span style={{ ...th, textAlign: "right" }}>Δ 7D</span>
      <span style={th}>Driver</span>
    </>
  );
}

function MoverRow({ m }: { m: DashboardMover }) {
  const dir = m.delta > 0 ? "↑" : m.delta < 0 ? "↓" : "→";
  const dirColor = m.delta > 0 ? "var(--success)" : m.delta < 0 ? "var(--danger)" : "var(--text-3)";
  return (
    <Fragment>
      <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{m.ticker}</span>
      <span style={{ color: "var(--text-3)", fontSize: 11 }}>{m.layer_label}</span>
      <span style={{ color: "var(--text-1)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {m.final_score == null ? "—" : m.final_score.toFixed(1)} <span style={{ color: dirColor }}>{dir}</span>
      </span>
      <span style={{ color: dirColor, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {m.delta > 0 ? "+" : ""}{m.delta.toFixed(1)}
      </span>
      <span style={{ color: "var(--text-3)" }}>—</span>
    </Fragment>
  );
}

/* ---------------- gauge row stub (real GaugeCard wire-up next commit) ---------------- */

function GaugeRowStub() {
  const labels = ["NAAIM exposure", "AAII bull−bear (3wk)", "CNN Fear & Greed"];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 14,
      }}
    >
      {labels.map((l) => (
        <div
          key={l}
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 6,
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            background: "color-mix(in oklab, var(--surface-1) 60%, transparent)",
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
            {l}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-4)", fontFamily: "var(--m)" }}>
            gauge wire-up pending · see /regime
          </span>
        </div>
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
  return (
    <section
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        padding: "14px 18px 16px",
        background: "var(--surface-1)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
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

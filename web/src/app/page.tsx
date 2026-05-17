import { Fragment } from "react";
import { getDashboardSnapshot } from "@/lib/dashboard-data";

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

export default async function DashboardPage() {
  const snap = await getDashboardSnapshot();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header
        style={{
          padding: "18px 28px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-.014em",
            color: "var(--text-1)",
            fontFamily: "var(--m)",
          }}
        >
          Weekly snapshot
        </h1>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          {snap.asOf ? `as of ${snap.asOf}` : "no scoring run yet"} ·{" "}
          {snap.scoredCount} / {snap.universeSize} scored
          {snap.synthetic ? " · fixture mode" : ""}
        </span>
      </header>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 28px 32px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridAutoRows: "min-content",
          gap: "20px 24px",
        }}
      >
        <Section label="Tier distribution" wide>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {snap.tiers.map((t) => (
              <TierCell key={t.tier} {...t} />
            ))}
          </div>
        </Section>

        <Section label="Macro gate">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 32, fontFamily: "var(--m)", fontWeight: 600, color: "var(--text-1)" }}>
              {snap.macroMultiplier.toFixed(2)}×
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>
              Multiplier on High composites ≥ 75. {snap.macroGatesHit}/3 gates hit
              {snap.macroGatesHit === 0
                ? " (clean tape)."
                : snap.macroGatesHit === 1
                  ? " (one sentiment indicator stretched)."
                  : snap.macroGatesHit === 2
                    ? " (two indicators stretched — caution)."
                    : " (all three indicators stretched — risk-off)."}
            </div>
          </div>
        </Section>

        <Section label="Pipeline freshness">
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.65 }}>
            {snap.asOf
              ? `Latest scoring run: ${snap.asOf}. ${snap.scoredCount} of ${snap.universeSize} names produced a composite this run.`
              : "No scoring run yet. The Saturday chain (Q/G/V/M/S → composite) drives all surfaces below."}
          </div>
        </Section>

        <Section label="Top winners (composite Δ vs prior week)">
          <MoversList movers={snap.topWinners} positive />
        </Section>

        <Section label="Top losers (composite Δ vs prior week)">
          <MoversList movers={snap.topLosers} positive={false} />
        </Section>

        <Section label="Tier crossings this week" wide>
          {snap.crossings.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>No tier crossings this week.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto auto",
                gap: "6px 14px",
                fontSize: 12.5,
                fontFamily: "var(--m)",
              }}
            >
              {snap.crossings.map((c) => (
                <CrossingRow key={c.ticker} c={c} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section
      style={{
        gridColumn: wide ? "1 / -1" : undefined,
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        padding: "14px 18px 16px",
        background: "var(--surface-1)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
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
      {children}
    </section>
  );
}

function TierCell({ tier, current, prior, delta }: { tier: string; current: number; prior: number; delta: number }) {
  const deltaColor = delta > 0 ? "var(--success)" : delta < 0 ? "var(--danger)" : "var(--text-3)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: ".06em",
          color: TIER_COLORS[tier] ?? "var(--text-2)",
          fontFamily: "var(--m)",
        }}
      >
        {tier}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 26, fontFamily: "var(--m)", fontWeight: 600, color: "var(--text-1)" }}>{current}</span>
        <span style={{ fontSize: 11, color: deltaColor, fontFamily: "var(--m)" }}>
          {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "·"}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--m)" }}>was {prior}</span>
      </div>
    </div>
  );
}

function MoversList({ movers, positive }: { movers: Array<{ ticker: string; layer_label: string; final_score: number | null; delta: number; tier: string | null }>; positive: boolean }) {
  if (movers.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--text-3)" }}>None this week.</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: "6px 14px", fontSize: 12.5, fontFamily: "var(--m)" }}>
      {movers.map((m) => (
        <Fragment key={m.ticker}>
          <span style={{ fontWeight: 600 }}>{m.ticker}</span>
          <span style={{ color: "var(--text-3)", fontSize: 11 }}>{m.layer_label}</span>
          <span style={{ color: "var(--text-2)" }}>
            {m.final_score == null ? "—" : m.final_score.toFixed(1)}
          </span>
          <span style={{ color: positive ? "var(--success)" : "var(--danger)" }}>
            {m.delta > 0 ? "+" : ""}{m.delta.toFixed(1)}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function CrossingRow({ c }: { c: { ticker: string; layer_label: string; prior_tier: string | null; current_tier: string | null; delta: number | null; direction: "up" | "down" } }) {
  const arrow = c.direction === "up" ? "↑" : "↓";
  const color = c.direction === "up" ? "var(--success)" : "var(--danger)";
  return (
    <>
      <span style={{ fontWeight: 600 }}>{c.ticker}</span>
      <span style={{ color: "var(--text-3)", fontSize: 11 }}>{c.layer_label}</span>
      <span style={{ color: "var(--text-2)" }}>{c.prior_tier ?? "—"}</span>
      <span style={{ color }}>{arrow} {c.current_tier ?? "—"}</span>
      <span style={{ color: "var(--text-3)", fontSize: 11 }}>
        {c.delta == null ? "" : `${c.delta > 0 ? "+" : ""}${c.delta.toFixed(1)}`}
      </span>
    </>
  );
}

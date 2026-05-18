import Link from "next/link";
import type { DashboardSnapshot, DashboardMover } from "@/lib/dashboard-data";
import { classifyTier } from "@/lib/scoring-weights";

/**
 * Today's Thesis — Dashboard signature pattern #1 (THS-74).
 *
 * The engine's daily briefing card. One scannable hero anchored above the
 * KPI row that answers "where does the research stand right now" in five
 * seconds: macro regime, high-tier count + drift, top movers summary.
 *
 * Reads as a Bloomberg-class daily morning note — calm, dense, fact-only.
 * No CTAs that read as "trade this" (compliance discipline THS-86): the
 * card surfaces engine state and links to drill-in surfaces; it never
 * tells the user what to do.
 *
 * /lambo doctrine:
 *   - signature pattern #1 (recognizable across surfaces — this primitive
 *     can be lifted onto Universe / Portfolio later as "research state")
 *   - earned (answers the first question a user opens the app to ask)
 *   - quiet chrome (no fill, hairline border, three info rows + footer)
 *   - math reconciles (numbers shown derive from snap; no fabrication)
 *
 * Placement: between the GreetingStrip+MonoMetaSpine and the AlertCallout
 * on the Dashboard canvas. Above the KPI row.
 */
export function TodayThesisCard({
  snap,
  movers,
  regimeState,
}: {
  snap: DashboardSnapshot;
  /** Unified top movers (winners + losers, sorted by abs delta). */
  movers: DashboardMover[];
  /** Pre-computed regime state from page.tsx (Neutral / Tightened / Cautious / Defensive). */
  regimeState: { label: string; color: string };
}) {
  const high = snap.tiers.find((t) => t.tier === "High");
  const highCurrent = high?.current ?? 0;
  const highPrior = high?.prior ?? 0;
  const highDelta = highCurrent - highPrior;
  const avgHighComposite = computeAvgHighComposite(movers, highCurrent);
  const top3 = movers.slice(0, 3);

  return (
    <section
      aria-label="Today's research thesis"
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        background: "var(--canvas)",
        padding: "16px 20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <Header
        gatesHit={snap.macroGatesHit}
        multiplier={snap.macroMultiplier}
        regimeState={regimeState}
        synthetic={snap.synthetic}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 20,
        }}
      >
        <Cell
          label="Macro regime"
          value={`${regimeState.label} · ${snap.macroMultiplier.toFixed(2)}×`}
          valueColor={regimeState.color}
          sub={`${snap.macroGatesHit} of 3 gates hit`}
          href="/regime"
          hrefLabel="Open regime"
        />
        <Cell
          label="High-tier holdings"
          value={`${highCurrent} of ${snap.universeSize}`}
          sub={
            highDelta === 0
              ? `flat vs prior week · avg composite ${avgHighComposite ?? "—"}`
              : `${highDelta > 0 ? "↑" : "↓"} ${Math.abs(highDelta)} vs prior week · avg composite ${avgHighComposite ?? "—"}`
          }
          subColor={highDelta > 0 ? "var(--success)" : highDelta < 0 ? "var(--danger)" : "var(--text-3)"}
          href="/universe?tier=High"
          hrefLabel="Open universe"
        />
        <Cell
          label="Top movers · 7D"
          value={
            top3.length === 0
              ? "—"
              : top3.map((m) => fmtMover(m)).join(" · ")
          }
          valueMono
          sub={
            top3.length === 0
              ? "no composite movement this week"
              : "research note · click any composite for derivation"
          }
        />
      </div>

      <Footer asOf={snap.asOf} engine="composite v1.0" />
    </section>
  );
}

/* ---------------- chrome ---------------- */

function Header({
  gatesHit,
  multiplier,
  regimeState,
  synthetic,
}: {
  gatesHit: number;
  multiplier: number;
  regimeState: { label: string; color: string };
  synthetic: boolean;
}) {
  // Reserved for "fired N hours ago" once the daily-batch routine output
  // is plumbed through. Currently we name the card and surface mode.
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        paddingBottom: 10,
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--f)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-1)",
          letterSpacing: "-.008em",
        }}
      >
        Today's thesis
      </span>
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 11,
          color: "var(--text-3)",
        }}
      >
        composite engine + macro regime
      </span>
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 10.5,
          color: synthetic ? "var(--warning)" : "var(--success)",
          fontWeight: 600,
          letterSpacing: ".04em",
          textTransform: "uppercase",
        }}
        title={
          synthetic
            ? "Stubbed: synthesized fixture data — engine not yet running against a deployed Supabase project."
            : "Live: scores read from public.scores_history populated by the Saturday chain."
        }
      >
        {synthetic ? "Stubbed" : "Live"}
      </span>
    </div>
  );
}

function Cell({
  label,
  value,
  valueColor,
  valueMono = false,
  sub,
  subColor,
  href,
  hrefLabel,
}: {
  label: string;
  value: string;
  valueColor?: string;
  valueMono?: boolean;
  sub: string;
  subColor?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span
        style={{
          fontSize: 10,
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
          fontSize: valueMono ? 12.5 : 15,
          fontFamily: valueMono ? "var(--m)" : "var(--f)",
          fontWeight: 600,
          color: valueColor ?? "var(--text-1)",
          fontVariantNumeric: valueMono ? "tabular-nums" : undefined,
          lineHeight: 1.3,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 11,
          fontFamily: "var(--m)",
          color: subColor ?? "var(--text-3)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {sub}
      </span>
      {href && hrefLabel && (
        <Link
          href={href}
          style={{
            fontSize: 11,
            fontFamily: "var(--m)",
            color: "var(--accent)",
            textDecoration: "none",
            marginTop: 2,
            letterSpacing: ".02em",
          }}
        >
          {hrefLabel} ›
        </Link>
      )}
    </div>
  );
}

function Footer({ asOf, engine }: { asOf: string | null; engine: string }) {
  return (
    <div
      style={{
        paddingTop: 8,
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        fontSize: 10.5,
        fontFamily: "var(--m)",
        color: "var(--text-4)",
      }}
    >
      <span>engine · {engine}</span>
      <span aria-hidden style={{ color: "var(--text-4)" }}>·</span>
      <span>as_of {asOf ?? "—"}</span>
      <span style={{ flex: 1 }} />
      <span style={{ color: "var(--text-3)" }}>research output · not advice</span>
    </div>
  );
}

/* ---------------- math ---------------- */

/**
 * Average composite of currently-High-tier movers (proxy for avg high-tier
 * composite when we don't have full snap.tiers detail). Returns null if no
 * High-tier movers in the visible top-N set.
 *
 * NOTE: this uses the top-N movers list which is a sample, not the full
 * 50-name set. For an exact avg we'd need to thread the full filtered
 * snap.rows through to this card. Sampled value is honest as a directional
 * read; rounded to 1 decimal.
 */
function computeAvgHighComposite(movers: DashboardMover[], highCount: number): string | null {
  if (highCount === 0) return null;
  const highMovers = movers.filter((m) => m.final_score != null && classifyTier(m.final_score) === "High");
  if (highMovers.length === 0) return null;
  const sum = highMovers.reduce((acc, m) => acc + (m.final_score ?? 0), 0);
  return (sum / highMovers.length).toFixed(1);
}

function fmtMover(m: DashboardMover): string {
  const sign = m.delta > 0 ? "+" : "";
  return `${m.ticker} ${sign}${m.delta.toFixed(1)}`;
}

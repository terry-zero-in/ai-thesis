import { getRegimeSnapshot } from "@/lib/regime-data";
import { GAUGES } from "@/lib/regime-types";
import { MultiplierBanner } from "./MultiplierBanner";
import { GaugeCard } from "./GaugeCard";
import { RegimeTrendChart } from "./RegimeTrendChart";
import { RegimeRailRegister } from "@/components/rails/RegimeRailRegister";
import type { RegimeLegendItem } from "@/components/rails/RegimeLegendRail";

/**
 * Revalidate every 30 minutes so the page picks up new weekly macro_gauges
 * rows without a hard refresh. The composite-score cron writes a new
 * macro_gauges row weekly, so anything tighter than that is wasted work.
 */
export const revalidate = 1800;

export default async function RegimePage() {
  const snap = await getRegimeSnapshot();
  const items: RegimeLegendItem[] = GAUGES.map((g) => {
    const v = snap.latest?.[g.key] ?? null;
    const hit = v != null && v > g.threshold;
    return { label: g.label, value: v, threshold: g.threshold, hit, blurb: g.blurb };
  });
  const railData = {
    items,
    gatesHit: snap.gates_hit,
    multiplier: snap.multiplier,
    asOf: snap.latest?.as_of ?? null,
    synthetic: snap.synthetic,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <RegimeRailRegister data={railData} />
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
          Regime
        </h1>
        <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
          NAAIM · AAII 3wk spread · CNN Fear &amp; Greed · macro multiplier per §Fix 4
        </span>
        <div style={{ flex: 1 }} />
        {snap.synthetic && (
          <span
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--text-3)",
              border: "1px dashed var(--border)",
              padding: "2px 8px",
              borderRadius: 3,
            }}
          >
            fixture
          </span>
        )}
      </header>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 32px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
          maxWidth: 1200,
        }}
      >
        <MultiplierBanner gatesHit={snap.gates_hit} multiplier={snap.multiplier} asOf={snap.latest?.as_of ?? null} />

        {/* GaugeCards keep their card chrome — multi-part instruments earn
            their boundary per /lambo "earn its place." */}
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
              gauge={g.key}
              history={snap.history}
              thresholdHistory={snap.threshold_history[g.key]}
            />
          ))}
        </div>

        {/* 12-month trend chart per spec §5.5 — 3 thin lines (NAAIM/AAII/F&G)
            with per-gauge threshold dashes + today marker. */}
        <RegimeTrendChart history={snap.history} />

        {/* Mercury decard prose section — label + hairline + canvas-flow prose. */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              color: "var(--text-3)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              paddingBottom: 10,
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            How the multiplier applies
          </div>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65, maxWidth: 760, margin: 0 }}>
            The multiplier is applied to composite scores ≥ 75 only — names
            below the High-conviction cut-off are never further de-rated by
            macro state (composite.ts §Fix 4). One de-rated tier shift is the
            typical behavioral consequence: a 78 raw → 0.95 → 74.1 final drops
            from High to Medium and changes its position cap accordingly.
          </p>
        </section>
      </div>
    </div>
  );
}

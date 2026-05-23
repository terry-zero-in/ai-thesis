import { getRegimeSnapshot } from "@/lib/regime-data";
import { GAUGES, pickClosestGate } from "@/lib/regime-types";
import { MultiplierBanner } from "./MultiplierBanner";
import { GaugeCard } from "./GaugeCard";
import { RegimeTrendChart } from "./RegimeTrendChart";
import { GateHistory } from "./GateHistory";
import { RegimeRailRegister } from "@/components/rails/RegimeRailRegister";
import type { RegimeLegendItem } from "@/components/rails/RegimeLegendRail";
import { PageHeader } from "@/components/primitives/PageHeader";
import { EngineStatusStripAsync } from "@/components/primitives/EngineStatusStripAsync";

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
    return { key: g.key, label: g.label, value: v, threshold: g.threshold, hit, blurb: g.blurb };
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
      <PageHeader
        title="Regime"
        subtitle="NAAIM · AAII 3wk spread · CNN Fear & Greed · macro multiplier applied at composite"
        meta={[
          { label: "as_of", value: snap.latest?.as_of ?? "—" },
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
                    ? "Sample data — macro gauges shown against a pre-generated dataset for product preview."
                    : "Live data — macro gauges from the daily ingest cron, refreshed by the Tue 22:00 UTC chain."
                }
              >
                {snap.synthetic ? "Sample" : "Live"}
              </span>
            ),
          },
          { label: "gates", value: `${snap.gates_hit}/3` },
          { label: "multiplier", value: `${snap.multiplier.toFixed(2)}×` },
          { label: "macro chain", value: "Tue 22:00 UTC weekly" },
        ]}
      />
      <EngineStatusStripAsync />

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
        <MultiplierBanner
          gatesHit={snap.gates_hit}
          multiplier={snap.multiplier}
          asOf={snap.latest?.as_of ?? null}
          closestGate={pickClosestGate(snap.latest, snap.gates_hit)}
        />

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

        {/* "Last 5 gate-state changes" history per spec §5.5 — receipts list. */}
        <GateHistory changes={snap.gate_changes} />

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
            macro state. One de-rated tier shift is the typical behavioral
            consequence: a 78 raw × 0.95 = 74.1 final drops from High to
            Medium and changes its position cap accordingly.
          </p>
        </section>
      </div>
    </div>
  );
}

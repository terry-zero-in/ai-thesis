import { getRegimeSnapshot } from "@/lib/regime-data";
import { GAUGES } from "@/lib/regime-types";
import { MultiplierBanner } from "./MultiplierBanner";
import { GaugeCard } from "./GaugeCard";

/**
 * Revalidate every 30 minutes so the page picks up new weekly macro_gauges
 * rows without a hard refresh. The composite-score cron writes a new
 * macro_gauges row weekly, so anything tighter than that is wasted work.
 */
export const revalidate = 1800;

export default async function RegimePage() {
  const snap = await getRegimeSnapshot();

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
          padding: "20px 28px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          maxWidth: 1200,
        }}
      >
        <MultiplierBanner gatesHit={snap.gates_hit} multiplier={snap.multiplier} asOf={snap.latest?.as_of ?? null} />

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

        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "14px 18px",
            fontSize: 12,
            color: "var(--text-3)",
            lineHeight: 1.6,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              color: "var(--text-3)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            How the multiplier applies
          </div>
          The multiplier is applied to composite scores ≥ 75 only — names below
          the High-conviction cut-off are never further de-rated by macro state
          (composite.ts §Fix 4). One de-rated tier shift is the typical
          behavioral consequence: a 78 raw → 0.95 → 74.1 final drops from High
          to Medium and changes its position cap accordingly.
        </section>
      </div>
    </div>
  );
}

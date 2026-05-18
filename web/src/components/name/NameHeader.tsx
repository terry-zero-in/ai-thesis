import { LayerChip } from "@/components/universe/LayerChip";
import { TierBadge } from "@/components/universe/TierBadge";
import { HeroNumber } from "@/components/primitives/HeroNumber";
import { Sparkline } from "@/components/name/Sparkline";
import type { NameDetail } from "@/lib/name-detail-data";

export function NameHeader({ d }: { d: NameDetail }) {
  // 7-day delta: history is weekly per spec §7.3. history[-1] is latest,
  // history[-2] is the prior week. Compute on final_score (the actionable number).
  const lastTwo = d.history.slice(-2);
  const delta =
    lastTwo.length === 2 && lastTwo[0].final_score != null && lastTwo[1].final_score != null
      ? { value: Number((lastTwo[1].final_score - lastTwo[0].final_score).toFixed(1)), period: "7d" }
      : null;

  // Derivation chain — only renders the macro step when a multiplier was applied.
  // Composite is the raw score; Final = Composite × macro_multiplier.
  const derivation =
    d.composite != null && d.final_score != null && d.macro_multiplier < 1
      ? `Raw ${d.composite.toFixed(1)} · ×${d.macro_multiplier.toFixed(2)} macro (${d.macro_gates_hit} gate${
          d.macro_gates_hit === 1 ? "" : "s"
        } hit) · = ${d.final_score.toFixed(1)} effective`
      : d.composite != null && d.final_score != null
        ? `Raw ${d.composite.toFixed(1)} · macro ×1.00 (no gates) · = ${d.final_score.toFixed(1)} effective`
        : undefined;

  const attribution = d.as_of
    ? `scored ${d.as_of} · composite engine${d.synthetic ? " · fixture" : ""}`
    : undefined;

  return (
    // Mercury Pic 19 b2 (Credit Card): big metric block on left + chart on
    // right, side-by-side header. Bottom hairline divides header from canvas.
    <div
      style={{
        padding: "22px 32px 22px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)",
        gap: 36,
        alignItems: "start",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        {/* Top strip — ticker + name + meta + tier badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-.014em",
                  color: "var(--text-1)",
                  fontFamily: "var(--m)",
                }}
              >
                {d.ticker}
              </h1>
              <span style={{ fontSize: 14, color: "var(--text-2)" }}>{d.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, flexWrap: "wrap" }}>
              <LayerChip layer={d.layer} label={d.layer_label} />
              {d.as_of && (
                <span style={{ color: "var(--text-3)", fontFamily: "var(--m)" }}>
                  as of {d.as_of}
                  {d.synthetic ? " · fixture" : ""}
                </span>
              )}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <TierBadge tier={d.tier} />
        </div>

        {/* Hero — Final is the protagonist per spec §1.7 + §5.3 */}
        <HeroNumber
          label="Final score"
          value={d.final_score}
          delta={delta}
          derivation={derivation}
          attribution={attribution}
          size="lg"
        />
      </div>

      {/* Right — 12-week sparkline */}
      <div style={{ paddingTop: 22, minWidth: 0 }}>
        <Sparkline history={d.history} />
      </div>
    </div>
  );
}

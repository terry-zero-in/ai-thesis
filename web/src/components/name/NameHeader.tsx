import { LayerChip } from "@/components/universe/LayerChip";
import { TierBadge } from "@/components/universe/TierBadge";
import { HeroNumber } from "@/components/primitives/HeroNumber";
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
    <div
      style={{
        padding: "20px 28px 20px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* Top strip — ticker + name + meta */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
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

      {/* Hero block — Final is the protagonist per spec §1.7 + §5.3 */}
      <HeroNumber
        label="Final score"
        value={d.final_score}
        delta={delta}
        derivation={derivation}
        attribution={attribution}
        size="lg"
      />
    </div>
  );
}

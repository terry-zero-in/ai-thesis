import { Fragment } from "react";
import Link from "next/link";
import { LayerChip } from "@/components/universe/LayerChip";
import { TierBadge } from "@/components/universe/TierBadge";
import { HeroNumber } from "@/components/primitives/HeroNumber";
import { Sparkline } from "@/components/name/Sparkline";
import { SwitchNameChip } from "@/components/name/SwitchNameChip";
import { MonoMetaSpine } from "@/components/primitives/MonoMetaSpine";
import type { NameDetail } from "@/lib/name-detail-data";
import type { Tier } from "@/lib/universe-data";

const TIER_BANDS: Array<{ tier: Tier; label: string; range: string }> = [
  { tier: "High", label: "High", range: "≥75" },
  { tier: "Medium", label: "Medium", range: "60–75" },
  { tier: "Low", label: "Low", range: "45–60" },
  { tier: "Avoid", label: "Avoid", range: "<45" },
];

function TierLegend({ tier }: { tier: Tier | null }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontFamily: "var(--m)",
        letterSpacing: ".04em",
        marginTop: -2,
        display: "flex",
        gap: 7,
        flexWrap: "wrap",
        alignItems: "baseline",
      }}
    >
      {TIER_BANDS.map((b, i) => {
        const active = b.tier === tier;
        return (
          <Fragment key={b.tier}>
            {i > 0 && <span style={{ color: "var(--text-4)" }}>·</span>}
            <span
              style={{
                color: active ? "var(--text-2)" : "var(--text-4)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {b.label} {b.range}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

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
        ? `Raw ${d.composite.toFixed(1)} · macro ×1.00 (0/3 gates) · = ${d.final_score.toFixed(1)} effective`
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
              {/* Switch-name chip — clickable pill that opens the ⌘K palette
                  scoped to ticker search. Promoted from a muted text-4 hint
                  per Linear's "↗ Open issue picker" pattern — the keyboard
                  binding stays the shortcut, but the affordance is now a
                  discoverable on-canvas control rather than a quiet text. */}
              <SwitchNameChip />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, flexWrap: "wrap" }}>
              <LayerChip layer={d.layer} label={d.layer_label} />
              <MonoMetaSpine
                segments={[
                  { label: "as_of", value: d.as_of ?? "—" },
                  { label: "engine", value: "composite v1.0" },
                  {
                    label: "mode",
                    value: (
                      <span
                        style={{
                          color: d.synthetic ? "var(--warning)" : "var(--success)",
                          fontWeight: 600,
                          letterSpacing: ".02em",
                        }}
                        title={
                          d.synthetic
                            ? "Sample data — score shown against a pre-generated dataset for product preview."
                            : "Live data — score from your account's latest weekly engine run."
                        }
                      >
                        {d.synthetic ? "Sample" : "Live"}
                      </span>
                    ),
                  },
                  {
                    label: "macro",
                    value: (
                      <Link
                        href="/regime"
                        title="Open Regime page — full macro multiplier curve, gauges, and history"
                        style={{
                          color: "var(--text-2)",
                          textDecoration: "none",
                          borderBottom: "1px dotted var(--text-4)",
                          paddingBottom: 1,
                        }}
                      >
                        {d.macro_multiplier.toFixed(2)}× ({d.macro_gates_hit}/3)
                      </Link>
                    ),
                  },
                ]}
              />
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

        {/* Tier-cutoff legend — spec cutoffs from scoring-weights.ts
            classifyTier (75/60/45). Active band is elevated so the legend
            doubles as "you are here," explaining the TierBadge word at a
            glance instead of forcing the reader to infer the threshold. */}
        <TierLegend tier={d.tier} />
      </div>

      {/* Right column — 12-week trajectory chart. The chart is the value-
          add: it shows the SHAPE of the score's recent history, which is
          information the left's hero number cannot convey. Earlier S22
          attempts added a second HeroNumber (+2.4 12-week-change) on the
          right; that competed with the left's protagonist and duplicated
          information the chart already shows. /lambo "one protagonist per
          screen" — the chart alone, sized big, balances the left. */}
      <div style={{ paddingTop: 6, minWidth: 0 }}>
        <Sparkline history={d.history} height={200} />
      </div>
    </div>
  );
}


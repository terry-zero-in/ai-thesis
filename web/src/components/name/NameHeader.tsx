import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { LayerChip } from "@/components/universe/LayerChip";
import { TierBadge } from "@/components/universe/TierBadge";
import { HeroNumber } from "@/components/primitives/HeroNumber";
import { DerivationLadder } from "@/components/primitives/DerivationLadder";
import { SwitchNameChip } from "@/components/name/SwitchNameChip";
import { MonoMetaSpine } from "@/components/primitives/MonoMetaSpine";
import { TraceTarget } from "@/components/conviction/TraceTarget";
import type { TraceData } from "@/components/conviction/TraceProvider";
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

export function NameHeader({
  d,
  scoreMathSlot,
  trace,
}: {
  d: NameDetail;
  scoreMathSlot?: ReactNode;
  trace?: TraceData | null;
}) {
  // 7-day delta: history is weekly per spec §7.3. history[-1] is latest,
  // history[-2] is the prior week. Compute on final_score (the actionable number).
  const lastTwo = d.history.slice(-2);
  const delta =
    lastTwo.length === 2 && lastTwo[0].final_score != null && lastTwo[1].final_score != null
      ? { value: Number((lastTwo[1].final_score - lastTwo[0].final_score).toFixed(1)), period: "7d" }
      : null;

  // Derivation chain — composite → macro → effective, rendered as a
  // <DerivationLadder> pipeline (signature pattern #2 per /lambo) so the
  // math reads as a directed flow (→ glyphs) rather than an equation with
  // mid-dots. Replaces the legacy hand-rolled string passed to HeroNumber's
  // `derivation` prop. Always renders when composite + final exist so the
  // "show your work" affordance is consistent regardless of whether macro
  // is active (1.00× still earns a row — the engine ran, the gate count is
  // public information).
  const ladderSteps =
    d.composite != null && d.final_score != null
      ? [
          { label: "raw", value: d.composite.toFixed(1) },
          {
            label: "macro",
            value: `×${d.macro_multiplier.toFixed(2)}`,
            note: `${d.macro_gates_hit}/3`,
          },
          { label: "effective", value: d.final_score.toFixed(1) },
        ]
      : null;

  const attribution = d.as_of
    ? `scored ${d.as_of} · composite engine${d.synthetic ? " · fixture" : ""}`
    : undefined;

  // T-trace hint chip — quiet 10px mono affordance signaling the keyboard
  // shortcut to users who don't know about it yet. Only renders when trace
  // data exists (engine has run twice on this name) so we never hint at a
  // shortcut that will produce an empty overlay.
  const traceHint = trace ? (
    <span
      title="Press T while hovering the score to open the provenance trace"
      style={{
        fontFamily: "var(--m)",
        fontSize: 10,
        color: "var(--text-4)",
        letterSpacing: ".04em",
        whiteSpace: "nowrap",
      }}
    >
      T trace ↗
    </span>
  ) : null;

  return (
    // Single-column hero. Earlier two-column variant (S22) put a 12-week
    // sparkline on the right as a counterweight to the FINAL SCORE hero on
    // the left, but the canonical trajectory visualization is
    // NameScoreChart below — a dual-axis composite + price chart at full
    // canvas width. A second mini-chart in the hero was redundant noise
    // (Terry 2026-05-20). The hero now owns identity + current score +
    // derivation only; trajectory lives downstream where it has room to
    // breathe. /lambo "one protagonist per screen."
    <div
      style={{
        padding: "22px 32px 22px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        {/* Top strip — ticker + name + switch + tier (inline) over meta row.
            S22: TierBadge moved INTO the ticker row alongside SwitchNameChip;
            previously sat parallel to the 2-row stack with a flex:1 spacer
            that pushed it to the canvas-right edge once the hero collapsed
            to a single column. The badge belongs next to the name — same
            reading line as "GOOGL · Alphabet · Switch name · [Low]". */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
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
              <TierBadge tier={d.tier} />
              {(scoreMathSlot || traceHint) && (
                <span
                  style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {traceHint}
                  {scoreMathSlot}
                </span>
              )}
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

        {/* Hero — Final is the protagonist per spec §1.7 + §5.3.
            The composite number is wrapped in <TraceTarget> when trace data
            is available so pressing T arms the Score Provenance Trace
            overlay (Lambo Pass §G feature 1). The derivation chain renders
            as <DerivationLadder> inline beneath via the `footer` slot —
            replaces the legacy mid-dot string with → glyphs so the math
            reads as a pipeline, not an equation. */}
        <HeroNumber
          label="Final score"
          value={d.final_score}
          delta={delta}
          attribution={attribution}
          size="lg"
          wrapValue={
            trace
              ? (node) => <TraceTarget data={trace}>{node}</TraceTarget>
              : undefined
          }
          footer={
            ladderSteps ? (
              <DerivationLadder steps={ladderSteps} fontSize={12.5} />
            ) : null
          }
        />

        {/* Tier-cutoff legend — spec cutoffs from scoring-weights.ts
            classifyTier (75/60/45). Active band is elevated so the legend
            doubles as "you are here," explaining the TierBadge word at a
            glance instead of forcing the reader to infer the threshold. */}
        <TierLegend tier={d.tier} />
      </div>

    </div>
  );
}


"use client";

import { tierAWeights, type LayerCode, type TierAWeights, classifyTier } from "@/lib/scoring-weights";

/**
 * Score Math derivation ladder — THS-73 signature pattern #2.
 *
 * Renders the full composite-to-final derivation for one ticker. Reads as
 * a Bloomberg-grade audit row: every visible number reconciles end-to-end,
 * weights are explicit, macro adjustment is annotated, tier classification
 * cites its cutpoint.
 *
 * /lambo discipline (math reconciles end-to-end):
 *   1. Q · G · V · AIQ — raw factor scores
 *   2. × weights (rescaled Tier-A per layer)
 *   3. = weighted composite
 *   4. × macro multiplier (M-gate curve)
 *   5. = final score
 *   6. → tier classification (cutpoint cited)
 *
 * Usage: <ScoreMath input={{ticker, layer, q, g, v, aiq, macroGatesHit, ...}} />.
 * Drop into any popover, drawer, or detail page. Self-contained — no external
 * tooltips, no router awareness. The component does math, presents the proof.
 */

export interface ScoreMathInput {
  ticker: string;
  layer: number;
  layerLabel: string;
  q: number | null;
  g: number | null;
  v: number | null;
  aiq: number | null;
  composite: number | null;
  finalScore: number | null;
  macroGatesHit: number;
  macroMultiplier: number;
  asOf: string | null;
  engineVersion?: string;
}

export function ScoreMath({ input }: { input: ScoreMathInput }) {
  const isValidLayer = input.layer >= 1 && input.layer <= 5;
  const weights = isValidLayer ? tierAWeights(input.layer as LayerCode) : null;

  return (
    <div
      style={{
        fontFamily: "var(--m)",
        fontSize: 12,
        color: "var(--text-2)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        minWidth: 320,
      }}
    >
      <Header input={input} />

      <Section title="Inputs · raw factor scores">
        <FactorRow label="Q" value={input.q} description="Quality" />
        <FactorRow label="G" value={input.g} description="Growth" />
        <FactorRow label="V" value={input.v} description="Valuation" />
        <FactorRow label="AIQ" value={input.aiq} description="AI exposure quality" lastInGroup />
      </Section>

      {weights && (
        <Section title={`× Layer-${input.layer} weights · Tier-A rescaled`}>
          <WeightRow label="Q" weight={weights.Q} score={input.q} />
          <WeightRow label="G" weight={weights.G} score={input.g} />
          <WeightRow label="V" weight={weights.V} score={input.v} />
          <WeightRow label="AIQ" weight={weights.AIQ} score={input.aiq} lastInGroup />
        </Section>
      )}

      <Section title="= Weighted composite">
        <ResultRow
          label="Composite"
          value={input.composite}
          annotation={
            weights && input.q != null && input.g != null && input.v != null && input.aiq != null
              ? `derived: ${(
                  weights.Q * input.q +
                  weights.G * input.g +
                  weights.V * input.v +
                  weights.AIQ * input.aiq
                ).toFixed(2)}`
              : "engine output"
          }
        />
      </Section>

      <Section title="× Macro multiplier · M-gate curve">
        <MultiplierRow
          gatesHit={input.macroGatesHit}
          multiplier={input.macroMultiplier}
        />
      </Section>

      <Section title="= Final score" lastSection>
        <ResultRow
          label="Final"
          value={input.finalScore}
          annotation={
            input.composite != null && input.macroMultiplier != null
              ? `${input.composite.toFixed(1)} × ${input.macroMultiplier.toFixed(2)} = ${(input.composite * input.macroMultiplier).toFixed(2)}`
              : undefined
          }
          highlight
        />
        {input.finalScore != null && (
          <TierRow finalScore={input.finalScore} />
        )}
      </Section>

      <Footer input={input} />
    </div>
  );
}

/* ---------------- header / footer chrome ---------------- */

function Header({ input }: { input: ScoreMathInput }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        paddingBottom: 10,
        borderBottom: "1px solid var(--border-subtle)",
        marginBottom: 4,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", fontFamily: "var(--m)" }}>
        {input.ticker}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>
        {input.layerLabel}
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>
        Score Math
      </span>
    </div>
  );
}

function Footer({ input }: { input: ScoreMathInput }) {
  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        gap: 12,
        fontSize: 10.5,
        color: "var(--text-4)",
        fontFamily: "var(--m)",
      }}
    >
      <span>engine · composite v1.0</span>
      <span aria-hidden style={{ color: "var(--text-4)" }}>·</span>
      <span>as_of {input.asOf ?? "—"}</span>
      <span style={{ flex: 1 }} />
      <span style={{ color: "var(--text-3)" }}>research output · not advice</span>
    </div>
  );
}

/* ---------------- section primitives ---------------- */

function Section({
  title,
  children,
  lastSection = false,
}: {
  title: string;
  children: React.ReactNode;
  lastSection?: boolean;
}) {
  return (
    <div
      style={{
        paddingTop: 10,
        paddingBottom: lastSection ? 0 : 10,
        borderBottom: lastSection ? undefined : "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          marginBottom: 8,
          fontFamily: "var(--m)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function FactorRow({
  label,
  value,
  description,
  lastInGroup = false,
}: {
  label: string;
  value: number | null;
  description: string;
  lastInGroup?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr auto",
        gap: 8,
        alignItems: "baseline",
        padding: "4px 0",
        marginBottom: lastInGroup ? 0 : 2,
      }}
    >
      <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "var(--text-3)", fontSize: 11 }}>{description}</span>
      <span style={{ color: value == null ? "var(--text-4)" : "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
        {value == null ? "—" : value.toFixed(1)}
      </span>
    </div>
  );
}

function WeightRow({
  label,
  weight,
  score,
  lastInGroup = false,
}: {
  label: string;
  weight: number;
  score: number | null;
  lastInGroup?: boolean;
}) {
  const contribution = score == null ? null : weight * score;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px 64px 1fr auto",
        gap: 8,
        alignItems: "baseline",
        padding: "4px 0",
        marginBottom: lastInGroup ? 0 : 2,
      }}
    >
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span style={{ color: "var(--text-3)", fontVariantNumeric: "tabular-nums", fontSize: 11 }}>
        {(weight * 100).toFixed(1)}%
      </span>
      <span style={{ color: "var(--text-4)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
        {score == null ? "—" : `× ${score.toFixed(1)}`}
      </span>
      <span style={{ color: contribution == null ? "var(--text-4)" : "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
        {contribution == null ? "—" : contribution.toFixed(2)}
      </span>
    </div>
  );
}

function ResultRow({
  label,
  value,
  annotation,
  highlight = false,
}: {
  label: string;
  value: number | null;
  annotation?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "baseline",
        padding: highlight ? "8px 12px" : "4px 0",
        background: highlight ? "var(--accent-soft)" : undefined,
        border: highlight ? "1px solid var(--accent-border)" : undefined,
        borderRadius: highlight ? 4 : undefined,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ color: highlight ? "var(--text-1)" : "var(--text-2)", fontWeight: highlight ? 600 : 500 }}>
          {label}
        </span>
        {annotation && (
          <span style={{ fontSize: 10.5, color: "var(--text-4)", fontVariantNumeric: "tabular-nums" }}>
            {annotation}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: highlight ? 18 : 13,
          fontWeight: 600,
          color: value == null ? "var(--text-4)" : highlight ? "var(--accent)" : "var(--text-1)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value == null ? "—" : value.toFixed(1)}
      </span>
    </div>
  );
}

function MultiplierRow({
  gatesHit,
  multiplier,
}: {
  gatesHit: number;
  multiplier: number;
}) {
  const stateLabel =
    gatesHit >= 3 ? "Defensive" :
    gatesHit === 2 ? "Cautious" :
    gatesHit === 1 ? "Tightened" :
    "Neutral";
  const stateColor =
    gatesHit >= 3 ? "var(--danger)" :
    gatesHit >= 1 ? "var(--warning)" :
    "var(--success)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 8,
        alignItems: "baseline",
        padding: "4px 0",
      }}
    >
      <span style={{ color: "var(--text-3)", fontSize: 11 }}>
        {gatesHit} of 3 macro gates hit · {stateLabel}
      </span>
      <span style={{ color: stateColor, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
        ×
      </span>
      <span
        style={{
          color: gatesHit > 0 ? "var(--warning)" : "var(--text-1)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
        }}
      >
        {multiplier.toFixed(2)}
      </span>
    </div>
  );
}

function TierRow({ finalScore }: { finalScore: number }) {
  const tier = classifyTier(finalScore);
  const tierColor =
    tier === "High" ? "var(--accent)" :
    tier === "Medium" ? "var(--warning)" :
    tier === "Low" ? "var(--info)" :
    "var(--danger)";
  const cutpoint =
    tier === "High" ? "≥ 75" :
    tier === "Medium" ? "60 – 74" :
    tier === "Low" ? "45 – 59" :
    "< 45";
  return (
    <div
      style={{
        marginTop: 8,
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        fontSize: 11,
      }}
    >
      <span style={{ color: "var(--text-3)" }}>Tier classification</span>
      <span style={{ flex: 1 }} />
      <span style={{ color: tierColor, fontWeight: 600 }}>{tier}</span>
      <span style={{ color: "var(--text-4)", fontVariantNumeric: "tabular-nums" }}>
        cutpoint {cutpoint}
      </span>
    </div>
  );
}

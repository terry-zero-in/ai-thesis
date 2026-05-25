import type { ReactNode } from "react";

/**
 * DerivationLadder — inline "show your work" chain for any headline number.
 *
 * Signature pattern #2 of 3 in the AI Thesis design doctrine, alongside
 * MonoMetaSpine (#1, page-level provenance anchor) and QuietActionRow (#3,
 * the unobtrusive verb row). Per /lambo: "signature patterns propagate" —
 * one shape, repeated across the surface, makes the system legible.
 *
 * Renders a single horizontal JetBrains Mono row stepping a metric through
 * its derivation, with `→` glyphs separating steps. Each step is
 * `<label-muted>  <value-text2>  <(note)-text4>?`. The terminal step's
 * value is rendered in --text-1 so the eye lands on "the answer" of the
 * chain without a heavier glyph or color shift.
 *
 * Per /lambo doctrine: "every computed number has a source attribution
 * nearby" and "math reconciles end-to-end." This primitive is how a
 * headline number proves both at once, inline, without a hover or click.
 *
 * Propagation targets:
 *   - Dashboard P&L            (NAV → mark-to-market → market value)
 *   - Portfolio Market Value   (cost basis → unrealized → market value)
 *   - Universe Detail composite (raw → macro multiplier → effective)
 *   - Regime active multiplier (gates → multiplier → engine weight)
 *
 * Example invocations:
 *   // composite score under a 36px BigNumber on Universe Detail
 *   <DerivationLadder fontSize={12.5} steps={[
 *     { label: "raw", value: "83.7" },
 *     { label: "macro", value: "×1.00", note: "0/3" },
 *     { label: "effective", value: "83.7" },
 *   ]} />
 *
 *   // Dashboard P&L line under the day's market value
 *   <DerivationLadder steps={[
 *     { label: "NAV", value: "$79,475" },
 *     { label: "mark-to-market", value: "+$1,595" },
 *     { label: "market value", value: "$81,070" },
 *   ]} />
 *
 *   // Regime active multiplier explanation
 *   <DerivationLadder steps={[
 *     { label: "gates", value: "0/3" },
 *     { label: "multiplier", value: "1.00×" },
 *     { label: "100% engine weight", value: "" },
 *   ]} />
 */
export interface LadderStep {
  /** Mono label, e.g. "raw", "macro", "effective", "gates". Muted color. */
  label: string;
  /** Value content — string or rich ReactNode. Rendered in text-2 color
   *  (text-1 for the terminal step so it reads as the answer). */
  value: ReactNode;
  /** Optional parenthetical to follow value, e.g. "(0/3 gates fired)". Rendered text-4. */
  note?: string;
}

export interface DerivationLadderProps {
  steps: LadderStep[];
  /** Override font size (default 11.5). Bump to 12.5 for hero contexts
   *  where this is the secondary line under a 36px BigNumber. */
  fontSize?: number;
  /** Override gap between steps (default 6). */
  gap?: number;
  /** Optional aria-label for screen readers (default "Derivation"). */
  ariaLabel?: string;
}

export function DerivationLadder({
  steps,
  fontSize = 11.5,
  gap = 6,
  ariaLabel = "Derivation",
}: DerivationLadderProps) {
  if (steps.length === 0) return null;
  const lastIndex = steps.length - 1;
  return (
    <div
      aria-label={ariaLabel}
      style={{
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        fontSize,
        fontFamily: "var(--m)",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.5,
        letterSpacing: 0,
      }}
    >
      {steps.map((s, i) => {
        const isLast = i === lastIndex;
        return (
          <span
            key={i}
            style={{ display: "inline-flex", alignItems: "baseline", whiteSpace: "nowrap" }}
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                style={{
                  color: "var(--text-4)",
                  margin: `0 ${gap}px`,
                }}
              >
                →
              </span>
            )}
            <span style={{ color: "var(--text-4)", marginRight: 4 }}>{s.label}</span>
            <span
              style={{
                color: isLast ? "var(--text-1)" : "var(--text-2)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.value}
            </span>
            {s.note && (
              <span style={{ color: "var(--text-4)", marginLeft: 4 }}>({s.note})</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

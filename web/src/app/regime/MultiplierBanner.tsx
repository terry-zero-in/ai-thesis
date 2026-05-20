import { MULTIPLIER_BY_GATES, fmtGaugeValue, type ClosestGate } from "@/lib/regime-types";
import { HeroNumber } from "@/components/primitives/HeroNumber";
import { MultiplierLadder, type LadderStep } from "@/components/primitives/MultiplierLadder";

/**
 * Top-of-page banner: gates hit, active multiplier, and the gate-by-gate
 * curve so the operator can see how much one more gate would tighten.
 *
 * Multiplier is rendered via HeroNumber (signature pattern #1) at size xl
 * with severity-encoded color: text-1 at 0 gates, warning at 1, danger at 2+.
 */
export function MultiplierBanner({
  gatesHit,
  multiplier,
  asOf,
  closestGate,
}: {
  gatesHit: number;
  multiplier: number;
  asOf: string | null;
  closestGate: ClosestGate | null;
}) {
  const valueColor = gatesHit === 0 ? "var(--text-1)" : gatesHit === 1 ? "var(--warning)" : "var(--danger)";
  const derivation = `${gatesHit} of 3 gates hit · applied only to composite ≥ 75 (high-tier names)`;
  const attribution = asOf ? `snapshot ${asOf} · macro engine` : undefined;
  return (
    // Mercury decard: top + bottom hairlines define the strip; cells flow
    // on canvas. Vertical hairline between hero cell and ladder cell.
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <Cell wide>
        <HeroNumber
          label="Active Multiplier"
          value={multiplier}
          unit="×"
          precision={2}
          size="xl"
          valueColor={valueColor}
          derivation={derivation}
          attribution={attribution}
        />
        {closestGate && (
          <span
            style={{
              alignSelf: "flex-start",
              marginTop: 8,
              fontSize: 11,
              fontFamily: "var(--m)",
              color: "var(--warning-text)",
              background: "var(--warning-text-fill)",
              border: "1px solid var(--warning-text-border)",
              padding: "3px 9px",
              borderRadius: 6,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: ".01em",
            }}
            title={`${closestGate.label} at ${fmtGaugeValue(closestGate.value, closestGate.key)}, gate at ${fmtGaugeValue(closestGate.threshold, closestGate.key)}. If it fires, multiplier tightens ${multiplier.toFixed(2)}× → ${closestGate.nextMultiplier.toFixed(2)}×.`}
          >
            Approaching · {closestGate.label.split(" ")[0]} {closestGate.ptsToGate.toFixed(1)} pts to gate · next {closestGate.nextMultiplier.toFixed(2)}×
          </span>
        )}
      </Cell>

      <Cell label="Curve">
        <MultiplierLadder steps={GATE_LADDER_STEPS} activeKey={gatesHit} />
      </Cell>
    </div>
  );
}

/** Gate ladder steps — keyed by gate count, value = multiplier. */
const GATE_LADDER_STEPS: LadderStep[] = ([0, 1, 2, 3] as const).map((g) => ({
  key: g,
  label: `${g} gate${g === 1 ? "" : "s"}`,
  value: MULTIPLIER_BY_GATES[g].toFixed(2),
}));

function Cell({
  label,
  children,
  wide = false,
}: {
  label?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Balanced 50/50 split — the multiplier value and the curve carry equal
  // information weight (one is "current state," the other is "consequence
  // of state changes"). Earlier 1.4:1 favoring the hero made the left cell
  // float in empty space while the curve cell felt cramped.
  return (
    <div
      style={{
        flex: 1,
        padding: "16px 22px",
        borderRight: wide ? "1px solid var(--border-subtle)" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      {label && (
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

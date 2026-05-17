import { MULTIPLIER_BY_GATES } from "@/lib/regime-types";
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
}: {
  gatesHit: number;
  multiplier: number;
  asOf: string | null;
}) {
  const valueColor = gatesHit === 0 ? "var(--text-1)" : gatesHit === 1 ? "var(--warning)" : "var(--danger)";
  const derivation = `${gatesHit} of 3 gates hit · applied to raw ≥ 75 only`;
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
  return (
    <div
      style={{
        flex: wide ? 1.4 : 1,
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

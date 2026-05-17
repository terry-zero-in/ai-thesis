import { MULTIPLIER_BY_GATES } from "@/lib/regime-types";
import { HeroNumber } from "@/components/primitives/HeroNumber";

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
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: "var(--surface)",
        overflow: "hidden",
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
        <div style={{ display: "flex", gap: 0, marginTop: 4 }}>
          {[0, 1, 2, 3].map((g) => {
            const m = MULTIPLIER_BY_GATES[g as 0 | 1 | 2 | 3];
            const active = g === gatesHit;
            return (
              <div
                key={g}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  textAlign: "center",
                  background: active ? "var(--accent-soft)" : "transparent",
                  border: active ? "1px solid var(--accent-border)" : "1px solid var(--border)",
                  borderRadius: 4,
                  marginRight: g < 3 ? 4 : 0,
                }}
              >
                <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--m)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                  {g} gate{g === 1 ? "" : "s"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--m)",
                    fontSize: 14,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: active ? "var(--accent)" : "var(--text-2)",
                    marginTop: 2,
                  }}
                >
                  {m.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      </Cell>
    </div>
  );
}

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
        padding: "14px 18px",
        borderRight: wide ? "1px solid var(--border)" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 4,
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

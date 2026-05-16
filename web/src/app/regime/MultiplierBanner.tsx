import { MULTIPLIER_BY_GATES } from "@/lib/regime-types";

/**
 * Top-of-page banner: gates hit, active multiplier, and the gate-by-gate
 * curve so the operator can see how much one more gate would tighten.
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
  const color = gatesHit === 0 ? "var(--text-1)" : gatesHit === 1 ? "#FBBF24" : "#FB7185";
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
      <Cell label="Active Multiplier" wide>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--m)",
              fontSize: 32,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color,
              lineHeight: 1,
            }}
          >
            {multiplier.toFixed(2)}×
          </span>
          <span style={{ fontSize: 11.5, color: "var(--text-3)", fontFamily: "var(--m)" }}>
            {gatesHit} {gatesHit === 1 ? "gate" : "gates"} hit
          </span>
        </div>
        {asOf && (
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
            Snapshot as of {asOf}. Applied to high-conviction names (raw ≥ 75) only.
          </div>
        )}
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
                  background: active ? "rgba(34,211,238,.06)" : "transparent",
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
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        flex: wide ? 1 : 1.4,
        padding: "14px 18px",
        borderRight: wide ? "1px solid var(--border)" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
      }}
    >
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
      {children}
    </div>
  );
}

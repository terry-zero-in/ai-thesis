import { LayerChip } from "@/components/universe/LayerChip";
import { TierBadge } from "@/components/universe/TierBadge";
import type { NameDetail } from "@/lib/name-detail-data";

export function NameHeader({ d }: { d: NameDetail }) {
  return (
    <div
      style={{
        padding: "18px 28px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.014em", color: "var(--text-1)", fontFamily: "var(--m)" }}>
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
      <ScoreBlock label="Composite" value={d.composite} />
      <ScoreBlock label="Final" value={d.final_score} strong />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <TierBadge tier={d.tier} />
        {d.macro_gates_hit > 0 && d.macro_multiplier < 1 && (
          <span
            title={`Macro multiplier ${d.macro_multiplier}× · ${d.macro_gates_hit} gate${d.macro_gates_hit === 1 ? "" : "s"} hit`}
            style={{
              fontFamily: "var(--m)",
              fontSize: 10,
              color: "#FACC15",
              background: "rgba(250,204,21,.08)",
              border: "1px solid rgba(250,204,21,.28)",
              borderRadius: 3,
              padding: "1px 5px",
            }}
          >
            macro ×{d.macro_multiplier.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

function ScoreBlock({ label, value, strong }: { label: string; value: number | null; strong?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: strong ? 22 : 18,
          fontWeight: strong ? 600 : 400,
          fontVariantNumeric: "tabular-nums",
          color: strong ? "var(--text-1)" : "var(--text-2)",
          lineHeight: 1,
        }}
      >
        {value == null ? "—" : value.toFixed(1)}
      </span>
    </div>
  );
}

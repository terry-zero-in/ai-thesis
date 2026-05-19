import { GAUGES, fmtGaugeValue, type GaugeKey, type MacroGaugeRow, type ThresholdHistory } from "@/lib/regime-types";
import { GaugeBar } from "./GaugeBar";

/**
 * Single gauge card — current reading, horizontal threshold gauge per
 * spec §4.3, hit chip if currently fired, crossings-footer with most-
 * recent crossing date.
 *
 * The prior 52w wavy sparkline was replaced with GaugeBar (review §2.5
 * #2 "the wave is decorative; the bar is dispositive"). 12-month trend
 * comes back as a separate page-level chart (review §2.5 #4).
 *
 * Gate-hit chip + value color use --warning (spec §4.3 + spec §2.1 binds
 * gate-hit to amber, not red).
 */
export function GaugeCard({
  gauge,
  history,
  thresholdHistory,
}: {
  gauge: GaugeKey;
  history: MacroGaugeRow[];
  thresholdHistory: ThresholdHistory;
}) {
  const meta = GAUGES.find((g) => g.key === gauge)!;
  const values = history.map((h) => h[gauge]).filter((v): v is number => v != null);
  const latest = values[values.length - 1] ?? null;
  const fired = latest != null && latest > meta.threshold;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: ".08em",
            flex: 1,
          }}
        >
          {meta.label}
        </span>
        {fired && (
          <span
            style={{
              fontSize: 9.5,
              fontFamily: "var(--m)",
              color: "var(--warning)",
              border: "1px solid rgba(221,168,90,.40)",
              background: "var(--warning-soft)",
              padding: "1px 6px",
              borderRadius: 3,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            gate hit
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 28,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: fired ? "var(--warning)" : "var(--text-1)",
            lineHeight: 1,
          }}
        >
          {latest == null ? "—" : fmtGaugeValue(latest, gauge)}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
          gate at {fmtGaugeValue(meta.threshold, gauge)}
        </span>
      </div>

      <GaugeBar value={latest} threshold={meta.threshold} range={meta.range} fired={fired} />

      <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{meta.blurb}</div>

      <div
        style={{
          fontSize: 10.5,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          paddingTop: 8,
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          {thresholdHistory.hits === 0
            ? "No crossings in last 52 weeks."
            : `${thresholdHistory.hits} crossing${thresholdHistory.hits === 1 ? "" : "s"} in last 52w`}
        </span>
        {thresholdHistory.last_hit_at && <span>last · {thresholdHistory.last_hit_at}</span>}
      </div>
    </div>
  );
}


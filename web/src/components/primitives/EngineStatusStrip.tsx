"use client";

import type { ReactNode } from "react";
import { Tip } from "@/components/shell/Tip";
import type { EngineStatus } from "@/lib/engine-status";

/**
 * Engine-Status Metadata Strip — THS-73 sub-pattern #1, sitewide.
 *
 * A single horizontal mono line that anchors every analytical surface in
 * its data-freshness state. Renders just below the PageHeader (or above
 * the rest of the canvas on surfaces that don't use PageHeader).
 *
 * Visual: hairline-quiet at rest, full audit answer one hover away.
 *   `as_of YYYY-MM-DD · prices ... · macro ... · AIQ ... · engine v1.0 · mode: Tier-A Composite`
 *
 * Each segment is a `<Tip>`-wrapped span — hovering reveals the source
 * table + last-refresh phrasing. The strip itself stays a featureless
 * 11px mono line so it never competes with the title above or the
 * canvas content below.
 *
 * Empty-state policy: missing values render as `—` rather than dropping
 * the segment. Operator should be able to see "macro: —" and read it as
 * "macro table is empty / RLS denied" — not "macro segment was removed."
 */
export function EngineStatusStrip({ status }: { status: EngineStatus }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0 14px",
        padding: "8px 32px 10px",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: 11,
        fontFamily: "var(--m)",
        color: "var(--text-3)",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.4,
        background: "var(--canvas)",
        flexShrink: 0,
      }}
      aria-label="Engine status"
    >
      <Seg
        label="as_of"
        value={status.asOf}
        tip="Latest scores_history.as_of — the canonical week the engine is showing."
        isFirst
      />
      <Seg
        label="prices"
        value={status.prices}
        tip="Latest prices_raw.as_of — FMP daily-close ingestion."
      />
      <Seg
        label="macro"
        value={status.macro}
        tip="Latest macro_gauges.as_of — NAAIM / AAII / Fear & Greed (Tue 22:00 UTC chain)."
      />
      <Seg
        label="AIQ"
        value={status.aiq}
        tip="Latest aiq_rubric.scored_at — manual quarterly AIQ scoring."
      />
      <Seg
        label="engine"
        value={status.engineVersion}
        tip="Composite engine version. v1.0 = Tier-A (Q/G/V/AIQ) with macro multiplier + concentration tax. M and S are qualitative until v2."
      />
      <Seg
        label="mode"
        value={status.mode}
        valueColor="var(--text-2)"
        tip="Active scoring mode. Tier-A Composite weights Q+G+V+AIQ per layer; M and S are qualitative annotations only until the v2 engine ships."
        bold
      />
    </div>
  );
}

interface SegProps {
  label: string;
  value: ReactNode | null | undefined;
  tip: string;
  isFirst?: boolean;
  valueColor?: string;
  bold?: boolean;
}

function Seg({ label, value, tip, isFirst, valueColor, bold }: SegProps) {
  const rendered: ReactNode = value == null || value === "" ? "—" : value;
  return (
    <>
      {!isFirst && <span style={{ color: "var(--text-4)" }}>·</span>}
      <Tip label={tip} side="bottom">
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 4,
            cursor: "default",
          }}
        >
          <span style={{ color: "var(--text-4)" }}>{label}</span>
          <span
            style={{
              color: value == null ? "var(--text-4)" : (valueColor ?? "var(--text-2)"),
              fontWeight: bold ? 600 : 400,
            }}
          >
            {rendered}
          </span>
        </span>
      </Tip>
    </>
  );
}

"use client";

import type { MarketTrigger } from "@/lib/portfolio-types";
import { RailHeader, RailSection, RailFooter } from "./RailChrome";

/**
 * /portfolio right rail — Master Design Spec §6:
 *   "Reserve tracker + two pre-committed triggers"
 *
 * Sole source of truth for the Reserve & Triggers surface — canvas
 * previously rendered a near-identical ReservePanel; that's been removed.
 * The rail is the persistent operating-state context across every page,
 * so Reserve lives here, not on the portfolio canvas where it would
 * compete with the positions table for primary attention.
 *
 * Trigger count — spec amendment (Terry-confirmed 2026-05-17, lambo-review §2.4 #4):
 * Spec §6 says "two pre-committed triggers" (Position drawdown >7%; SPY ≤ −5%
 * / VIX >25 for 3+ days). Build decomposes the market condition into two
 * separately-firing kinds (spy_daily_drop + vix_sustained) so an operator
 * can see WHICH market signal tripped, yielding 1 position + 2 market = 3
 * total. This is a refinement, not a deviation: union still matches spec
 * intent; firing granularity is the upgrade.
 */
export interface PortfolioReserveRailData {
  reserveActual: number;
  reserveTarget: number;
  totalCapital: number;
  positionTriggerCount: number;
  positionTriggerDetail: string;
  marketTriggers: MarketTrigger[];
  asOf: string | null;
  empty: boolean;
}

export function PortfolioReserveRail({ data }: { data: PortfolioReserveRailData }) {
  const { reserveActual, reserveTarget, totalCapital, positionTriggerCount, positionTriggerDetail, marketTriggers, asOf, empty } = data;
  const reservePct = totalCapital > 0 ? reserveActual / totalCapital : 0;
  const targetPct = totalCapital > 0 ? reserveTarget / totalCapital : 0;
  const onTarget = reserveActual >= reserveTarget;
  const firedCount =
    (positionTriggerCount > 0 ? 1 : 0) + marketTriggers.filter((t) => t.fired).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RailHeader
        label="Reserve & triggers"
        right={
          firedCount > 0 ? (
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--m)",
                color: "var(--danger)",
                letterSpacing: ".06em",
                textTransform: "uppercase",
              }}
            >
              {firedCount} fired
            </span>
          ) : undefined
        }
      />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <RailSection title="Reserve">
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span
              style={{
                fontFamily: "var(--m)",
                fontSize: 22,
                fontWeight: 600,
                color: empty ? "var(--text-4)" : onTarget ? "var(--text-1)" : "var(--danger)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {fmtUsd(reserveActual)}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
              of {fmtUsd(totalCapital)}
            </span>
          </div>
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,.04)",
              borderRadius: 2,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, reservePct * 100))}%`,
                height: "100%",
                background: onTarget ? "var(--accent)" : "var(--danger)",
                opacity: 0.7,
              }}
            />
            <div
              title={`Target reserve: ${fmtUsd(reserveTarget)}`}
              style={{
                position: "absolute",
                left: `${Math.max(0, Math.min(100, targetPct * 100))}%`,
                top: -2,
                width: 1,
                height: 8,
                background: "var(--text-2)",
                opacity: 0.6,
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            Target {fmtUsd(reserveTarget)} ({(targetPct * 100).toFixed(0)}%).{" "}
            {onTarget ? "On target." : `Short ${fmtUsd(reserveTarget - reserveActual)}.`}
          </span>
        </RailSection>

        <RailSection title="Triggers" divider={false}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <TriggerPill
              label="Position drawdown ≥ 7%"
              fired={positionTriggerCount > 0}
              detail={positionTriggerDetail}
            />
            {marketTriggers.map((t) => (
              <TriggerPill
                key={t.kind}
                label={t.kind === "spy_daily_drop" ? "SPY single-day drop ≥ 5%" : "VIX ≥ 25 for 3+ days"}
                fired={t.fired}
                detail={t.detail}
              />
            ))}
          </div>
        </RailSection>
      </div>
      <RailFooter>
        {asOf && (
          <span>
            Prices as of <span style={{ fontFamily: "var(--m)", color: "var(--text-2)" }}>{asOf}</span>
          </span>
        )}
      </RailFooter>
    </div>
  );
}

function TriggerPill({ label, fired, detail }: { label: string; fired: boolean; detail: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: fired ? "var(--danger)" : "rgba(255,255,255,.15)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 11.5,
            color: fired ? "var(--text-1)" : "var(--text-2)",
            fontFamily: "var(--m)",
            flex: 1,
            minWidth: 0,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 9.5,
            fontFamily: "var(--m)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: fired ? "var(--danger)" : "var(--text-3)",
          }}
        >
          {fired ? "fired" : "clear"}
        </span>
      </div>
      <span
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          lineHeight: 1.45,
          paddingLeft: 14,
        }}
      >
        {detail}
      </span>
    </div>
  );
}

function fmtUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return `${sign}$${body}`;
}

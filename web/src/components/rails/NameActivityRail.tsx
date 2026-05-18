"use client";

import { RailHeader, RailSection, RailEmpty, RailGhost, RailFooter } from "./RailChrome";

/**
 * /universe/[ticker] right rail — Master Design Spec §6:
 *   "Activity log, recent score changes, insider events, news links"
 *
 * Sub-sections:
 * - ACTIVITY: composite wk/wk deltas from the 12-wk history, dep-flag
 *   events interleaved by date. Most-recent 6 events.
 * - INSIDER: deferred-feature ghost (THS-58 — same ticket as the
 *   bottom-of-canvas DataPendingCard, kept consistent).
 * - NEWS: deferred-feature ghost (THS-59).
 */
export interface NameActivityEvent {
  date: string;
  kind: "score" | "depflag";
  label: string;
  /** Composite delta for score events; null otherwise. */
  delta: number | null;
}

export interface NameActivityRailData {
  ticker: string;
  events: NameActivityEvent[];
  asOf: string | null;
  synthetic: boolean;
}

export function NameActivityRail({ data }: { data: NameActivityRailData }) {
  const { ticker, events, asOf, synthetic } = data;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RailHeader label={`${ticker} · Activity`} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <RailSection title="Recent events">
          {events.length === 0 ? (
            <RailEmpty>No score movement or flags in the last 12 weeks.</RailEmpty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {events.map((e, i) => (
                <EventRow key={`${e.date}-${i}`} e={e} isLast={i === events.length - 1} />
              ))}
            </div>
          )}
        </RailSection>

        <RailSection title="Insider · Form 4">
          <RailGhost ticket="THS-58" label="Latest insider transactions land here once Form 4 ingestion ships." />
        </RailSection>

        <RailSection title="News · headlines" divider={false}>
          <RailGhost ticket="THS-59" label="Headlines + sentiment land here once news ingestion ships." />
        </RailSection>
      </div>
      <RailFooter>
        {asOf && (
          <span>
            As of <span style={{ fontFamily: "var(--m)", color: "var(--text-2)" }}>{asOf}</span>
            {synthetic ? " (fixture)" : ""}
          </span>
        )}
      </RailFooter>
    </div>
  );
}

function EventRow({ e, isLast }: { e: NameActivityEvent; isLast: boolean }) {
  const isFlag = e.kind === "depflag";
  const dirColor =
    e.delta == null
      ? "var(--text-3)"
      : e.delta > 0
        ? "var(--success)"
        : e.delta < 0
          ? "var(--danger)"
          : "var(--text-3)";
  const deltaStr =
    e.delta == null ? "" : `${e.delta > 0 ? "+" : ""}${e.delta.toFixed(1)}`;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 10,
        alignItems: "baseline",
        padding: "8px 0",
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        fontFamily: "var(--m)",
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          color: "var(--text-3)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: ".02em",
        }}
      >
        {e.date.slice(5)}
      </span>
      <span
        style={{
          fontSize: 11.5,
          color: isFlag ? "var(--warning)" : "var(--text-2)",
          lineHeight: 1.4,
          minWidth: 0,
        }}
      >
        {e.label}
      </span>
      <span
        style={{
          fontSize: 11.5,
          color: dirColor,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {deltaStr}
      </span>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { Tier, UniverseRow } from "@/lib/universe-data";
import type { UniverseFlag } from "@/hooks/universe-filter-context";

/**
 * UniverseInsightsRail — replaces the Tier-chip section of UniverseFilterRail
 * with a stacked bar chart + synchronized legend table. Click any bar OR any
 * legend row → toggle the corresponding Tier filter. Active filter dims the
 * non-active bars (Linear's exact pattern from Terry's S9 screenshots).
 *
 * v1 scope (locked S9 in docs/design/insights-primitive-and-dashboard.md §6):
 *   - Measure = count
 *   - Slice   = Tier (HIGH / MEDIUM / LOW / AVOID — 4 bars)
 *   - Segment = none (single-color bars, Tier-colored)
 *
 * v1.1 (deferred): Measure dropdown, Segment selector (stacked-by-Layer),
 * Slice dropdown (Layer / AIQ band / Macro gate as alternate axes).
 *
 * Layer + AIQ + Flags sections preserved BELOW the Insights surface as
 * power-user filters — chart is the primary affordance; chips remain for
 * dimensions the chart doesn't yet expose.
 */

const TIERS: Tier[] = ["High", "Medium", "Low", "Avoid"];

const TIER_COLORS: Record<Tier, string> = {
  High: "var(--accent)",
  Medium: "var(--warning)",
  Low: "var(--info)",
  Avoid: "var(--danger)",
};

const LAYERS: { id: number; label: string }[] = [
  { id: 1, label: "L1 Compute" },
  { id: 2, label: "L2 Hyperscaler" },
  { id: 3, label: "L3 App" },
  { id: 4, label: "L4 Power" },
  { id: 5, label: "L5 Incumbent" },
];

// Only wired flags surface. Depreciation + Burry overstatement land when
// the underlying ingestion ships; until then we don't show ghost toggles
// (no self-referential ticket citation, no unclickable boxes).
const FLAGS: { id: UniverseFlag; label: string }[] = [
  { id: "macro", label: "Macro gate hit" },
];

interface Props {
  rows: UniverseRow[];
  layers: Set<number>;
  tiers: Set<Tier>;
  aiqMin: number | null;
  flags: Set<UniverseFlag>;
  onToggleLayer: (l: number) => void;
  onToggleTier: (t: Tier) => void;
  onSetAiqMin: (v: number | null) => void;
  onToggleFlag: (f: UniverseFlag) => void;
  onClear: () => void;
}

interface TierAgg {
  tier: Tier;
  count: number;
  avgFinal: number | null;
}

export function UniverseInsightsRail(props: Props) {
  const { rows, layers, tiers, aiqMin, flags, onToggleLayer, onToggleTier, onSetAiqMin, onToggleFlag, onClear } = props;
  const hasFilter = layers.size > 0 || tiers.size > 0 || aiqMin != null || flags.size > 0;

  // Aggregate counts + avg-final per Tier. Computed off ALL rows (not just
  // filtered) so the chart's totals are stable as the user toggles filters —
  // matches Linear's pattern where the bars represent the full data set and
  // the active filter is communicated via opacity, not by recomputing bars.
  const agg = useMemo<TierAgg[]>(() => {
    return TIERS.map((tier) => {
      const matching = rows.filter((r) => r.tier === tier);
      const finals = matching.map((r) => r.final_score).filter((f): f is number => f != null);
      const avg = finals.length > 0 ? finals.reduce((a, b) => a + b, 0) / finals.length : null;
      return { tier, count: matching.length, avgFinal: avg };
    });
  }, [rows]);

  const maxCount = useMemo(() => Math.max(1, ...agg.map((a) => a.count)), [agg]);
  const anyTierActive = tiers.size > 0;

  // Per /universe review item 10: histogram sum (e.g. 4+10+18+18=50) was
  // diverging from the table's "scored" count (52) because rows with
  // `r.tier == null` weren't counted anywhere on the rail. Surface the
  // delta as a quiet "(N unscored)" line so the math reconciles.
  const tieredCount = useMemo(() => agg.reduce((sum, a) => sum + a.count, 0), [agg]);
  const unscoredCount = rows.length - tieredCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RailHeader label="Insights" right={hasFilter ? <ClearBtn onClick={onClear} /> : null} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Bar chart — Slice=Tier, Measure=count. Single-color bars (v1). */}
        <Section title="Tier distribution">
          <BarChart
            agg={agg}
            maxCount={maxCount}
            activeTiers={tiers}
            anyActive={anyTierActive}
            onToggle={onToggleTier}
          />
          {unscoredCount > 0 && (
            <div
              style={{
                fontSize: 10.5,
                fontFamily: "var(--m)",
                color: "var(--text-4)",
                letterSpacing: ".02em",
                paddingTop: 8,
                fontStyle: "italic",
              }}
              title={`${unscoredCount} name${unscoredCount === 1 ? "" : "s"} in the snapshot ${unscoredCount === 1 ? "has" : "have"} no tier classification (composite null or unscored).`}
            >
              + {unscoredCount} unscored
            </div>
          )}
        </Section>

        {/* Legend table — second affordance, synchronized with bar chart. */}
        <Section title="Legend">
          <LegendTable agg={agg} activeTiers={tiers} anyActive={anyTierActive} onToggle={onToggleTier} />
        </Section>

        {/* Layer chips — preserved from old rail (slice dimension chart doesn't expose v1). */}
        <Section title="Layer">
          <ChipGrid>
            {LAYERS.map((l) => (
              <FilterChip key={l.id} active={layers.has(l.id)} onClick={() => onToggleLayer(l.id)}>
                {l.label}
              </FilterChip>
            ))}
          </ChipGrid>
        </Section>

        {/* AIQ floor slider — preserved from old rail. */}
        <Section title="AIQ minimum">
          <AiqSlider value={aiqMin} onChange={onSetAiqMin} />
        </Section>

        {/* Flag toggles — only wired flags surface (see FLAGS const). */}
        <Section title="Flags" divider={false}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FLAGS.map((f) => (
              <FlagToggle
                key={f.id}
                label={f.label}
                active={flags.has(f.id)}
                onClick={() => onToggleFlag(f.id)}
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

/**
 * Bar chart — one bar per Tier, height proportional to count / maxCount.
 * Active state per Linear pattern: when ANY tier active, non-active bars
 * drop to opacity 0.3 and lose color saturation. Active bars stay full.
 */
function BarChart({
  agg,
  maxCount,
  activeTiers,
  anyActive,
  onToggle,
}: {
  agg: TierAgg[];
  maxCount: number;
  activeTiers: Set<Tier>;
  anyActive: boolean;
  onToggle: (t: Tier) => void;
}) {
  const CHART_H = 90;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-around",
          height: CHART_H,
          paddingBottom: 4,
          borderBottom: "1px solid var(--border-subtle)",
          gap: 8,
        }}
      >
        {agg.map(({ tier, count }) => {
          const isActive = activeTiers.has(tier);
          const dimmed = anyActive && !isActive;
          const barH = Math.max(2, (count / maxCount) * (CHART_H - 18));
          return (
            <button
              key={tier}
              onClick={() => onToggle(tier)}
              title={`${tier}: ${count} ${count === 1 ? "name" : "names"} · click to ${isActive ? "clear" : "filter"}`}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                opacity: dimmed ? 0.3 : 1,
                transition: "opacity var(--dur-instant) var(--ease-out)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--m)",
                  fontSize: 10,
                  color: dimmed ? "var(--text-4)" : "var(--text-2)",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {count}
              </span>
              <div
                style={{
                  width: "100%",
                  height: barH,
                  background: TIER_COLORS[tier],
                  borderRadius: 2,
                  filter: dimmed ? "saturate(0.4)" : undefined,
                  transition: "filter var(--dur-instant) var(--ease-out)",
                }}
              />
            </button>
          );
        })}
      </div>
      {/* Tier-name labels under bars */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          paddingTop: 6,
          gap: 8,
        }}
      >
        {agg.map(({ tier }) => {
          const isActive = activeTiers.has(tier);
          const dimmed = anyActive && !isActive;
          return (
            <span
              key={tier}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 9.5,
                fontFamily: "var(--m)",
                color: isActive ? "var(--text-1)" : dimmed ? "var(--text-4)" : "var(--text-3)",
                letterSpacing: ".06em",
                textTransform: "uppercase",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {tier}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Legend table — color dot · tier · count · avg final score. Whole row
 * clickable → same toggle behavior as bar. Active row gets a 2px accent
 * left rail per feedback_active_state_indicator_2px_floor.
 */
function LegendTable({
  agg,
  activeTiers,
  anyActive,
  onToggle,
}: {
  agg: TierAgg[];
  activeTiers: Set<Tier>;
  anyActive: boolean;
  onToggle: (t: Tier) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {agg.map(({ tier, count, avgFinal }) => {
        const isActive = activeTiers.has(tier);
        const dimmed = anyActive && !isActive;
        return (
          <button
            key={tier}
            onClick={() => onToggle(tier)}
            style={{
              display: "grid",
              gridTemplateColumns: "12px 1fr auto auto",
              gap: 8,
              alignItems: "baseline",
              padding: "6px 8px",
              borderLeft: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
              background: isActive ? "var(--elevated)" : "transparent",
              border: "none",
              borderRadius: 0,
              cursor: "pointer",
              opacity: dimmed ? 0.4 : 1,
              fontFamily: "var(--m)",
              fontVariantNumeric: "tabular-nums",
              transition: "background var(--dur-instant) var(--ease-out),opacity var(--dur-instant) var(--ease-out)",
              textAlign: "left",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: TIER_COLORS[tier],
                marginLeft: 2,
              }}
            />
            <span
              style={{
                fontSize: 11.5,
                color: isActive ? "var(--text-1)" : "var(--text-2)",
                letterSpacing: ".02em",
              }}
            >
              {tier}
            </span>
            <span
              style={{
                fontSize: 11.5,
                color: isActive ? "var(--text-1)" : "var(--text-2)",
                fontWeight: isActive ? 600 : 500,
              }}
            >
              {count}
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: "var(--text-3)",
              }}
            >
              {avgFinal != null ? `avg ${avgFinal.toFixed(1)}` : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Below: chrome + form primitives (lifted from UniverseFilterRail)
// Kept inline for v1 to avoid premature abstraction; will hoist to
// /rails/RailChrome.tsx if/when a third rail needs the same shapes.
// ─────────────────────────────────────────────────────────────

function RailHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-3)",
        letterSpacing: ".06em",
        textTransform: "uppercase",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {right}
    </div>
  );
}

function ClearBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lin-hov"
      style={{
        fontSize: 10,
        fontFamily: "var(--m)",
        color: "var(--text-3)",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 3,
        padding: "2px 7px",
        letterSpacing: ".04em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      Clear
    </button>
  );
}

function Section({
  title,
  children,
  divider = true,
}: {
  title: string;
  children: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: divider ? "1px solid var(--border-subtle)" : undefined,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>;
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 9px",
        borderRadius: 3,
        fontSize: 11,
        color: active ? "var(--accent)" : "var(--text-2)",
        background: active ? "var(--accent-soft)" : "rgba(255,255,255,.02)",
        border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
        whiteSpace: "nowrap",
        cursor: "pointer",
        transition:
          "background var(--dur-instant) var(--ease-out),color var(--dur-instant) var(--ease-out),border-color var(--dur-instant) var(--ease-out)",
      }}
    >
      {children}
    </button>
  );
}

function AiqSlider({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const v = value ?? 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 18,
            fontWeight: 600,
            color: value == null ? "var(--text-4)" : "var(--text-1)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {value == null ? "—" : value}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: "var(--text-3)",
            fontFamily: "var(--m)",
            letterSpacing: ".04em",
            textTransform: "uppercase",
          }}
        >
          {value == null ? "no floor" : "AIQ ≥"}
        </span>
        <div style={{ flex: 1 }} />
        {value != null && (
          <button
            onClick={() => onChange(null)}
            className="lin-hov"
            style={{
              fontSize: 9.5,
              fontFamily: "var(--m)",
              color: "var(--text-3)",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "1px 6px",
              letterSpacing: ".04em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Off
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={v}
        onChange={(e) => {
          const next = parseInt(e.target.value, 10);
          onChange(next === 0 ? null : next);
        }}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--text-4)",
          fontFamily: "var(--m)",
        }}
      >
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

function FlagToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 4,
        background: active ? "var(--accent-soft)" : "transparent",
        border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
        fontSize: 11.5,
        fontFamily: "var(--f)",
        color: active ? "var(--accent)" : "var(--text-2)",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: 2,
          border: `1px solid ${active ? "var(--accent)" : "var(--text-4)"}`,
          background: active ? "var(--accent)" : "transparent",
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
    </button>
  );
}

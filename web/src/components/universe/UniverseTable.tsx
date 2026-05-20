"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Tier, UniverseRow } from "@/lib/universe-data";
import { useFilter } from "@/hooks/filter-context";
import { useUniverseFilter } from "@/hooks/universe-filter-context";
import { TierBadge } from "./TierBadge";
import { LayerChip } from "./LayerChip";
import { MiniBar } from "./MiniBar";
import { ScoreMathPopover } from "@/components/primitives/ScoreMathPopover";
import type { ScoreMathInput } from "@/components/primitives/ScoreMath";

type SortKey = "ticker" | "name" | "layer" | "composite" | "final" | "tier" | "delta";
type SortDir = "asc" | "desc";

interface Props {
  rows: UniverseRow[];
  asOf: string | null;
  synthetic: boolean;
  /** Tickers currently in aiq_draft_queue (status queued/processing). Renders a small Q pill. */
  queuedTickers?: string[];
}

const TIER_ORDER: Record<Tier, number> = { High: 0, Medium: 1, Low: 2, Avoid: 3 };

export function UniverseTable({ rows, asOf, synthetic, queuedTickers = [] }: Props) {
  const queuedSet = useMemo(() => new Set(queuedTickers), [queuedTickers]);
  const { q } = useFilter();
  const { layers, tiers, aiqMin, flags } = useUniverseFilter();
  const [sortKey, setSortKey] = useState<SortKey>("final");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Per /universe review item 4: hide Δw + Macro columns when ZERO rows
  // carry signal. Empty columns imply data should be there. Compute off
  // the unfiltered set so toggling filters doesn't make columns appear /
  // disappear mid-session.
  const hasAnyDelta = useMemo(
    () => rows.some((r) => r.delta != null && Number.isFinite(r.delta)),
    [rows],
  );
  const hasAnyMacro = useMemo(
    () => rows.some((r) => r.macro_gates_hit > 0 && r.macro_multiplier < 1),
    [rows],
  );
  // Final differs from Comp only when macro multiplier de-rates. With macro at
  // 1.00× across all rows (today's state: 0 gates), the two columns are
  // identical — same redundancy pattern as the Macro column.
  const hasAnyFinalDelta = useMemo(
    () => rows.some(
      (r) => r.composite != null && r.final_score != null && Math.abs(r.composite - r.final_score) > 0.05,
    ),
    [rows],
  );

  const filtered = useMemo(() => {
    const qNorm = q.trim().toUpperCase();
    return rows.filter((r) => {
      if (layers.size > 0 && !layers.has(r.layer)) return false;
      if (tiers.size > 0 && (!r.tier || !tiers.has(r.tier))) return false;
      if (qNorm && !r.ticker.includes(qNorm) && !r.name.toUpperCase().includes(qNorm)) return false;
      if (aiqMin != null && (r.aiq == null || r.aiq < aiqMin)) return false;
      // Macro flag — only wired flag in fixture; rows must currently have ≥1 gate hit.
      if (flags.has("macro") && r.macro_gates_hit < 1) return false;
      // "depr" and "burry" remain unwired (pending THS-46 depreciation_flags
      // ingestion). They don't restrict the result set yet — the rail-side
      // toggle disables clicks + shows a pending note to match.
      return true;
    });
  }, [rows, layers, tiers, q, aiqMin, flags]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av == null && bv == null) return a.ticker.localeCompare(b.ticker);
      if (av == null) return 1; // nulls last regardless of dir
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return out;
  }, [filtered, sortKey, sortDir]);

  const handleSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      // Default direction: descending for numeric scores, ascending for labels.
      setSortDir(k === "ticker" || k === "name" || k === "layer" || k === "tier" ? "asc" : "desc");
    }
  };

  return (
    // Mercury #7 — single scroll context on the page wrapper (overflow: auto
    // + overscroll-behavior: contain). thead sticks to the page-scroll top.
    // overscroll-behavior contains trackpad-swipe gestures so they don't
    // trigger browser back-nav or bleed content past sidebar/panel edges.
    <div style={{ background: "var(--canvas)" }}>
      <table
        style={{
          // width: 100% so the table fills its canvas — extra space distributes
          // proportionally across columns (now that Name has a width hint, no
          // single column absorbs all the slack). When rail expands, canvas
          // shrinks → table shrinks with it. When rail collapses, canvas grows
          // → table grows to fill, no empty gap on the right. Terry feedback
          // 2026-05-19: table should not leave empty space when rail is closed,
          // and should not overlap rail content when open.
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12.5,
          minWidth: 1100,
        }}
      >
        <thead>
          <tr
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              background: "var(--canvas)",
              boxShadow: "inset 0 -1px 0 var(--border-subtle)",
            }}
          >
            <Th sortable k="ticker" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width={84}>
              Ticker
            </Th>
            <Th sortable k="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width={220}>
              Name
            </Th>
            <Th sortable k="layer" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width={140}>
              Layer
            </Th>
            <Th sortable k="composite" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" width={80}>
              Composite
            </Th>
            {hasAnyFinalDelta && (
              <Th sortable k="final" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" width={80}>
                Final
              </Th>
            )}
            <Th sortable k="tier" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width={84}>
              Tier
            </Th>
            <Th width={110} title="Quality factor — earnings stability, margins, operational durability (0–100)">Quality</Th>
            <Th width={110} title="Growth factor — revenue, EPS, FCF trajectory (0–100)">Growth</Th>
            <Th width={110} title="Value factor — multiples + reverse DCF vs sector (0–100)">Value</Th>
            <Th width={110} title="AIQ rubric — 6-dimension AI-readiness score (0–100)">AIQ</Th>
            {hasAnyDelta && (
              <Th sortable k="delta" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" width={64}>
                Δw
              </Th>
            )}
            {hasAnyMacro && (
              <Th align="center" width={48}>
                Macro
              </Th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={9 + (hasAnyFinalDelta ? 1 : 0) + (hasAnyDelta ? 1 : 0) + (hasAnyMacro ? 1 : 0)}
                style={{ padding: "32px 16px", color: "var(--text-3)", textAlign: "center" }}
              >
                No names match the current filters.
              </td>
            </tr>
          )}
          {sorted.map((r, i) => (
            <Row
              key={r.ticker}
              r={r}
              queued={queuedSet.has(r.ticker)}
              showDelta={hasAnyDelta}
              showMacro={hasAnyMacro}
              showFinal={hasAnyFinalDelta}
              rowIndex={i}
            />
          ))}
        </tbody>
      </table>
      {/* Review §2.2 #6 — footer count lives UNDER the table per spec, not in
          the rail. Quiet line; mono numerics; provenance + fixture flag. */}
      <div
        style={{
          padding: "10px 18px 16px",
          fontSize: 11,
          color: "var(--text-3)",
          display: "flex",
          gap: 10,
          alignItems: "baseline",
          fontFamily: "var(--m)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span style={{ color: "var(--text-2)" }}>
          Showing {sorted.length} of {rows.length} · click row for detail
        </span>
        {asOf && (
          <span>
            · as of <span style={{ color: "var(--text-2)" }}>{asOf}</span>
            {synthetic ? " · sample data" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function Row({
  r,
  queued,
  showDelta,
  showMacro,
  showFinal,
  rowIndex,
}: {
  r: UniverseRow;
  queued: boolean;
  showDelta: boolean;
  showMacro: boolean;
  showFinal: boolean;
  rowIndex: number;
}) {
  // All rows stagger in via row-stagger-in keyframe (opacity + 4px translate,
  // compositor-tier). Cascade is 25ms × rowIndex with a 1200ms ceiling so a
  // 50-row table finishes its wave in ~1.25s without the tail-rows-piled-up
  // burst that `Math.min(rowIndex, 12)` produced on a 50-row universe.
  // Dashboard / Portfolio aren't affected — they use the CSS-class default
  // 65ms cascade with ≤12 rows.
  const delayMs = Math.min(rowIndex * 25, 1200);
  const router = useRouter();
  // Full-row click → /universe/{ticker}. Matches Dashboard Score Movers
  // (#100) and Portfolio Positions (#106). Inner Ticker + Name Links keep
  // their hrefs so right-click "open in new tab" still works on those
  // cells; ScoreMathPopover triggers already call e.stopPropagation() so
  // opening the derivation popover does not navigate.
  return (
    <tr
      className="row-hov row-stagger-in"
      onClick={() => router.push(`/universe/${r.ticker}`)}
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        animationDelay: `${delayMs}ms`,
        cursor: "pointer",
      }}
    >
      <Td>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          <Link
            href={`/universe/${r.ticker}`}
            style={{
              fontFamily: "var(--m)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-1)",
              textDecoration: "none",
            }}
          >
            {r.ticker}
          </Link>
          {queued && (
            <span
              className="chip-fade-in"
              title="Queued for next AIQ rescore (daily-batch routine)"
              style={{
                fontSize: 9,
                fontFamily: "var(--m)",
                color: "var(--accent)",
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
                padding: "0 4px",
                borderRadius: 3,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                lineHeight: 1.6,
              }}
            >
              Q
            </span>
          )}
        </span>
      </Td>
      <Td>
        <Link
          href={`/universe/${r.ticker}`}
          style={{
            color: "var(--text-2)",
            textDecoration: "none",
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {r.name}
        </Link>
      </Td>
      <Td>
        <LayerChip layer={r.layer} label={r.layer_label} />
      </Td>
      <Td align="right" mono>
        <ScoreMathPopover input={scoreMathInputForRow(r)}>
          <span
            className="score-math-number"
            style={{
              fontVariantNumeric: "tabular-nums",
              borderBottom: "1px dotted transparent",
              transition: "border-color var(--dur-instant) var(--ease-out)",
              color: "inherit",
            }}
          >
            {fmt1(r.composite)}
          </span>
        </ScoreMathPopover>
      </Td>
      {showFinal && (
        <Td align="right" mono strong>
          <ScoreMathPopover input={scoreMathInputForRow(r)}>
            <span
              className="score-math-number"
              style={{
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
                borderBottom: "1px dotted transparent",
                transition: "border-color var(--dur-instant) var(--ease-out)",
                color: "inherit",
              }}
            >
              {fmt1(r.final_score)}
            </span>
          </ScoreMathPopover>
        </Td>
      )}
      <Td>
        <TierBadge tier={r.tier} />
      </Td>
      {/* Spec §5.2:493 — Q/G/V/AIQ cell bg tinted --accent-soft at score ≥80.
          MiniBar kept as the analytical upgrade; tint added on top so the
          row-level scan still surfaces high-conviction names. */}
      <Td tint={tintScore(r.q)}>
        <MiniBar label="Q" value={r.q} />
      </Td>
      <Td tint={tintScore(r.g)}>
        <MiniBar label="G" value={r.g} />
      </Td>
      <Td tint={tintScore(r.v)}>
        <MiniBar label="V" value={r.v} />
      </Td>
      <Td tint={tintScore(r.aiq)}>
        <MiniBar label="A" value={r.aiq} />
      </Td>
      {showDelta && (
        <Td align="right" mono>
          <DeltaCell d={r.delta} />
        </Td>
      )}
      {showMacro && (
        <Td align="center">
          <MacroFlag gates={r.macro_gates_hit} mult={r.macro_multiplier} />
        </Td>
      )}
    </tr>
  );
}

function DeltaCell({ d }: { d: number | null }) {
  if (d == null) return <span style={{ color: "var(--text-4)" }}>—</span>;
  const sign = d > 0 ? "+" : "";
  const color = d > 0 ? "var(--success)" : d < 0 ? "var(--danger)" : "var(--text-3)";
  return <span style={{ color }}>{sign}{d.toFixed(1)}</span>;
}

function MacroFlag({ gates, mult }: { gates: number; mult: number }) {
  if (gates === 0 || mult >= 1) {
    return <span style={{ color: "var(--text-4)", fontFamily: "var(--m)", fontSize: 11 }}>—</span>;
  }
  return (
    <span
      title={`Macro multiplier ${mult}× (${gates} gate${gates === 1 ? "" : "s"} hit)`}
      style={{
        fontFamily: "var(--m)",
        fontSize: 10,
        color: "var(--warning)",
        background: "var(--warning-soft)",
        border: "1px solid rgba(221,168,90,.30)",
        borderRadius: 3,
        padding: "1px 5px",
      }}
    >
      ×{mult.toFixed(2)}
    </span>
  );
}

function Th({
  children,
  k,
  sortKey,
  sortDir,
  onSort,
  sortable,
  align,
  width,
  title,
}: {
  children: React.ReactNode;
  k?: SortKey;
  sortKey?: SortKey;
  sortDir?: SortDir;
  onSort?: (k: SortKey) => void;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: number;
  title?: string;
}) {
  const active = sortable && k != null && sortKey === k;
  // Review §2.2 #7: sortable headers always show a sort affordance.
  // Active: ▲/▼ in --accent. Sortable-inactive: ⇅ in --text-4 (Linear quiet
  // pattern — capability visible, doesn't compete with active state).
  const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : sortable ? "⇅" : "";
  const arrowColor = active ? "var(--accent)" : "var(--text-4)";
  return (
    <th
      onClick={sortable && k && onSort ? () => onSort(k) : undefined}
      title={title}
      style={{
        position: "sticky",
        top: 0,
        padding: "10px 12px",
        textAlign: align ?? "left",
        fontSize: 10.5,
        fontFamily: "var(--m)",
        fontWeight: 500,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: active ? "var(--text-1)" : "var(--text-3)",
        cursor: sortable ? "pointer" : title ? "help" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        width,
      }}
    >
      {children}
      {arrow && (
        <span style={{ marginLeft: 5, fontSize: 8, color: arrowColor }}>{arrow}</span>
      )}
    </th>
  );
}

function Td({
  children,
  align,
  mono,
  strong,
  tint,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  strong?: boolean;
  tint?: boolean;
}) {
  return (
    <td
      style={{
        padding: "9px 12px",
        textAlign: align ?? "left",
        fontSize: 12.5,
        color: "var(--text-2)",
        fontFamily: mono ? "var(--m)" : undefined,
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
        fontWeight: strong ? 600 : undefined,
        background: tint ? "var(--accent-soft)" : undefined,
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function tintScore(v: number | null): boolean {
  return v != null && v >= 80;
}

function scoreMathInputForRow(r: UniverseRow): ScoreMathInput {
  return {
    ticker: r.ticker,
    layer: r.layer,
    layerLabel: r.layer_label,
    q: r.q,
    g: r.g,
    v: r.v,
    aiq: r.aiq,
    composite: r.composite,
    finalScore: r.final_score,
    macroGatesHit: r.macro_gates_hit,
    macroMultiplier: r.macro_multiplier,
    asOf: r.as_of,
  };
}

function fmt1(n: number | null) {
  if (n == null) return <span style={{ color: "var(--text-4)" }}>—</span>;
  return n.toFixed(1);
}

function sortValue(r: UniverseRow, k: SortKey): number | string | null {
  switch (k) {
    case "ticker":
      return r.ticker;
    case "name":
      return r.name;
    case "layer":
      return r.layer;
    case "composite":
      return r.composite;
    case "final":
      return r.final_score;
    case "tier":
      return r.tier ? TIER_ORDER[r.tier] : null;
    case "delta":
      return r.delta;
  }
}

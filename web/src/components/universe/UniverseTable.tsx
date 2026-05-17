"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Tier, UniverseRow } from "@/lib/universe-data";
import { useFilter } from "@/hooks/filter-context";
import { useUniverseFilter } from "@/hooks/universe-filter-context";
import { TierBadge } from "./TierBadge";
import { LayerChip } from "./LayerChip";
import { MiniBar } from "./MiniBar";

type SortKey = "ticker" | "name" | "layer" | "composite" | "final" | "tier" | "delta";
type SortDir = "asc" | "desc";

interface Props {
  rows: UniverseRow[];
  asOf: string | null;
  synthetic: boolean;
}

const TIER_ORDER: Record<Tier, number> = { High: 0, Medium: 1, Low: 2, Avoid: 3 };

export function UniverseTable({ rows, asOf, synthetic }: Props) {
  const { q } = useFilter();
  const { layers, tiers, setMeta } = useUniverseFilter();
  const [sortKey, setSortKey] = useState<SortKey>("final");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const qNorm = q.trim().toUpperCase();
    return rows.filter((r) => {
      if (layers.size > 0 && !layers.has(r.layer)) return false;
      if (tiers.size > 0 && (!r.tier || !tiers.has(r.tier))) return false;
      if (qNorm && !r.ticker.includes(qNorm) && !r.name.toUpperCase().includes(qNorm)) return false;
      return true;
    });
  }, [rows, layers, tiers, q]);

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

  // Publish row counts + provenance to the rail footer.
  useEffect(() => {
    setMeta({ totalRows: rows.length, visibleRows: sorted.length, asOf, synthetic });
  }, [rows.length, sorted.length, asOf, synthetic, setMeta]);

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
    <div
      style={{
        flex: 1,
        overflow: "auto",
        background: "var(--canvas)",
      }}
    >
      <table
        style={{
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
            <Th sortable k="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
              Name
            </Th>
            <Th sortable k="layer" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width={140}>
              Layer
            </Th>
            <Th sortable k="composite" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" width={80}>
              Comp
            </Th>
            <Th sortable k="final" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" width={80}>
              Final
            </Th>
            <Th sortable k="tier" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width={84}>
              Tier
            </Th>
            <Th width={100}>Q</Th>
            <Th width={100}>G</Th>
            <Th width={100}>V</Th>
            <Th width={100}>AIQ</Th>
            <Th sortable k="delta" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" width={64}>
              Δw
            </Th>
            <Th align="center" width={48}>
              Macro
            </Th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={12} style={{ padding: "32px 16px", color: "var(--text-3)", textAlign: "center" }}>
                No names match the current filters.
              </td>
            </tr>
          )}
          {sorted.map((r) => (
            <Row key={r.ticker} r={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ r }: { r: UniverseRow }) {
  return (
    <tr
      className="row-hov"
      style={{
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <Td>
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
        {fmt1(r.composite)}
      </Td>
      <Td align="right" mono strong>
        {fmt1(r.final_score)}
      </Td>
      <Td>
        <TierBadge tier={r.tier} />
      </Td>
      <Td>
        <MiniBar label="Q" value={r.q} />
      </Td>
      <Td>
        <MiniBar label="G" value={r.g} />
      </Td>
      <Td>
        <MiniBar label="V" value={r.v} />
      </Td>
      <Td>
        <MiniBar label="A" value={r.aiq} />
      </Td>
      <Td align="right" mono>
        <DeltaCell d={r.delta} />
      </Td>
      <Td align="center">
        <MacroFlag gates={r.macro_gates_hit} mult={r.macro_multiplier} />
      </Td>
    </tr>
  );
}

function DeltaCell({ d }: { d: number | null }) {
  if (d == null) return <span style={{ color: "var(--text-4)" }}>—</span>;
  const sign = d > 0 ? "+" : "";
  const color = d > 0 ? "#34D399" : d < 0 ? "#FB7185" : "var(--text-3)";
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
        color: "#FACC15",
        background: "rgba(250,204,21,.08)",
        border: "1px solid rgba(250,204,21,.28)",
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
}: {
  children: React.ReactNode;
  k?: SortKey;
  sortKey?: SortKey;
  sortDir?: SortDir;
  onSort?: (k: SortKey) => void;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: number;
}) {
  const active = sortable && k != null && sortKey === k;
  const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "";
  return (
    <th
      onClick={sortable && k && onSort ? () => onSort(k) : undefined}
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
        cursor: sortable ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        width,
      }}
    >
      {children}
      {arrow && (
        <span style={{ marginLeft: 5, fontSize: 8, color: "var(--accent)" }}>{arrow}</span>
      )}
    </th>
  );
}

function Td({
  children,
  align,
  mono,
  strong,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  strong?: boolean;
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
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
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

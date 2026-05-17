"use client";

import type { Tier } from "@/lib/universe-data";

const LAYERS: { id: number; label: string }[] = [
  { id: 1, label: "L1 Compute" },
  { id: 2, label: "L2 Hyperscaler" },
  { id: 3, label: "L3 App" },
  { id: 4, label: "L4 Power" },
  { id: 5, label: "L5 Incumbent" },
];

const TIERS: Tier[] = ["High", "Medium", "Low", "Avoid"];

interface Props {
  layers: Set<number>;
  tiers: Set<Tier>;
  onToggleLayer: (l: number) => void;
  onToggleTier: (t: Tier) => void;
  onClear: () => void;
  totalRows: number;
  visibleRows: number;
  asOf: string | null;
  synthetic: boolean;
}

export function UniverseFilterRail(props: Props) {
  const { layers, tiers, onToggleLayer, onToggleTier, onClear, totalRows, visibleRows, asOf, synthetic } = props;
  const hasFilter = layers.size > 0 || tiers.size > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header label="Filters" right={hasFilter ? <ClearBtn onClick={onClear} /> : null} />
      <Section title="Layer">
        <ChipGrid>
          {LAYERS.map((l) => (
            <FilterChip key={l.id} active={layers.has(l.id)} onClick={() => onToggleLayer(l.id)}>
              {l.label}
            </FilterChip>
          ))}
        </ChipGrid>
      </Section>
      <Section title="Tier">
        <ChipGrid>
          {TIERS.map((t) => (
            <FilterChip key={t} active={tiers.has(t)} onClick={() => onToggleTier(t)}>
              {t}
            </FilterChip>
          ))}
        </ChipGrid>
      </Section>
      <div style={{ flex: 1 }} />
      <Footer asOf={asOf} synthetic={synthetic} visibleRows={visibleRows} totalRows={totalRows} />
    </div>
  );
}

function Header({ label, right }: { label: string; right?: React.ReactNode }) {
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
      }}
    >
      Clear
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 16px 8px", borderBottom: "1px solid var(--border-subtle)" }}>
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
        transition: "background var(--dur-instant) var(--ease-out),color var(--dur-instant) var(--ease-out),border-color var(--dur-instant) var(--ease-out)",
      }}
    >
      {children}
    </button>
  );
}

function Footer({
  asOf,
  synthetic,
  visibleRows,
  totalRows,
}: {
  asOf: string | null;
  synthetic: boolean;
  visibleRows: number;
  totalRows: number;
}) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 11,
        color: "var(--text-3)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ fontFamily: "var(--m)", color: "var(--text-2)" }}>
        {visibleRows} / {totalRows} names
      </span>
      {asOf && (
        <span>
          As of <span style={{ fontFamily: "var(--m)", color: "var(--text-2)" }}>{asOf}</span>
          {synthetic ? " (fixture)" : ""}
        </span>
      )}
    </div>
  );
}

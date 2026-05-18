"use client";

import type { Tier } from "@/lib/universe-data";
import type { UniverseFlag } from "@/hooks/universe-filter-context";

const LAYERS: { id: number; label: string }[] = [
  { id: 1, label: "L1 Compute" },
  { id: 2, label: "L2 Hyperscaler" },
  { id: 3, label: "L3 App" },
  { id: 4, label: "L4 Power" },
  { id: 5, label: "L5 Incumbent" },
];

const TIERS: Tier[] = ["High", "Medium", "Low", "Avoid"];

const FLAGS: { id: UniverseFlag; label: string; wired: boolean; pending?: string }[] = [
  { id: "macro", label: "Macro gate hit", wired: true },
  { id: "depr", label: "Depreciation flag", wired: false, pending: "THS-46" },
  { id: "burry", label: "Burry overstatement", wired: false, pending: "THS-46" },
];

interface Props {
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

export function UniverseFilterRail(props: Props) {
  const {
    layers,
    tiers,
    aiqMin,
    flags,
    onToggleLayer,
    onToggleTier,
    onSetAiqMin,
    onToggleFlag,
    onClear,
  } = props;
  const hasFilter = layers.size > 0 || tiers.size > 0 || aiqMin != null || flags.size > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header label="Filters" right={hasFilter ? <ClearBtn onClick={onClear} /> : null} />
      <div style={{ flex: 1, overflowY: "auto" }}>
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
        <Section title="AIQ minimum">
          <AiqSlider value={aiqMin} onChange={onSetAiqMin} />
        </Section>
        <Section title="Flags">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FLAGS.map((f) => (
              <FlagToggle
                key={f.id}
                label={f.label}
                active={flags.has(f.id)}
                wired={f.wired}
                pending={f.pending}
                onClick={() => f.wired && onToggleFlag(f.id)}
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
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
        <span style={{ fontSize: 10.5, color: "var(--text-3)", fontFamily: "var(--m)", letterSpacing: ".04em", textTransform: "uppercase" }}>
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
        style={{
          width: "100%",
          accentColor: "var(--accent)",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-4)", fontFamily: "var(--m)" }}>
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
  wired,
  pending,
  onClick,
}: {
  label: string;
  active: boolean;
  wired: boolean;
  pending?: string;
  onClick: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <button
        onClick={onClick}
        disabled={!wired}
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
          color: !wired ? "var(--text-4)" : active ? "var(--accent)" : "var(--text-2)",
          textAlign: "left",
          cursor: wired ? "pointer" : "not-allowed",
          opacity: wired ? 1 : 0.6,
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
      {!wired && pending && (
        <span
          style={{
            fontSize: 10,
            color: "var(--text-4)",
            fontFamily: "var(--m)",
            paddingLeft: 22,
          }}
        >
          {pending} ingestion pending
        </span>
      )}
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


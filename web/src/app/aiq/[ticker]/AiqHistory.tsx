"use client";

import { DIMS, type AiqRow, type DimKey } from "@/lib/aiq-types";

/**
 * Audit history panel. Renders the last 20 versioned rows for this ticker,
 * newest first. Each row shows scored_at, total, and the per-dimension
 * deltas vs the previous version (red/green chip).
 */
export function AiqHistory({ history, envConfigured }: { history: AiqRow[]; envConfigured: boolean }) {
  if (!envConfigured) {
    return (
      <aside style={asideStyle}>
        <Header label="History" />
        <Empty>Connect Supabase to read prior versions.</Empty>
      </aside>
    );
  }
  if (history.length === 0) {
    return (
      <aside style={asideStyle}>
        <Header label="History" />
        <Empty>No prior scoring yet. Saves will appear here.</Empty>
      </aside>
    );
  }
  return (
    <aside style={asideStyle}>
      <Header label={`History · ${history.length}`} />
      <div style={{ display: "flex", flexDirection: "column", overflow: "auto" }}>
        {history.map((row, i) => {
          const prior = history[i + 1] ?? null;
          const deltas: Record<string, number> = {};
          if (prior) {
            for (const d of DIMS) {
              deltas[d.key] = (row[d.key as DimKey] as number) - (prior[d.key as DimKey] as number);
            }
          }
          return <HistoryRow key={row.scored_at} row={row} prior={prior} deltas={deltas} latest={i === 0} />;
        })}
      </div>
    </aside>
  );
}

function HistoryRow({
  row,
  prior,
  deltas,
  latest,
}: {
  row: AiqRow;
  prior: AiqRow | null;
  deltas: Record<string, number>;
  latest: boolean;
}) {
  const totalDelta = prior ? row.total - prior.total : 0;
  return (
    <div
      style={{
        padding: "12px 18px",
        borderBottom: "1px solid var(--border-subtle)",
        background: latest ? "var(--accent-soft)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "var(--m)", fontSize: 12, color: "var(--text-2)" }}>{row.scored_at}</span>
        {latest && (
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--m)",
              color: "var(--accent)",
              border: "1px solid var(--accent-border)",
              padding: "1px 5px",
              borderRadius: 3,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            current
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 14,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-1)",
          }}
        >
          {row.total}
        </span>
        {prior && totalDelta !== 0 && <Delta n={totalDelta} />}
      </div>
      {prior && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {DIMS.map((d) => {
            const dlt = deltas[d.key] ?? 0;
            if (dlt === 0) return null;
            return (
              <span
                key={d.key}
                style={{
                  fontSize: 10,
                  fontFamily: "var(--m)",
                  color: dlt > 0 ? "var(--success-text)" : "var(--danger-text)",
                  background: dlt > 0 ? "var(--success-text-fill)" : "var(--danger-text-fill)",
                  border: `1px solid ${dlt > 0 ? "var(--success-text-border)" : "var(--danger-text-border)"}`,
                  padding: "1px 6px",
                  borderRadius: 6,
                }}
              >
                {d.label.slice(0, 4)} {dlt > 0 ? "+" : ""}
                {dlt}
              </span>
            );
          })}
        </div>
      )}
      <SourcesLine sources={row.sources} />

      {row.notes && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
          {row.notes}
        </div>
      )}
    </div>
  );
}

// Renders per-dim sources from the JSONB column. Primary anchor = first
// available URL (disclosure preferred, falling back to dim order). Extra
// dims surface as a "+N more" count chip — quiet, honest, no crowding.
function SourcesLine({ sources }: { sources: { [k: string]: string } | null }) {
  if (!sources) return null;
  const entries = DIMS.map((d) => {
    const slug = d.key.replace(/_pts$/, "");
    const url = sources[slug];
    return url ? { slug, url } : null;
  }).filter((x): x is { slug: string; url: string } => x != null);
  if (entries.length === 0) return null;
  const primary = entries[0];
  const extra = entries.length - 1;
  return (
    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
      <a
        href={primary.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 10.5, color: "var(--accent)", textDecoration: "none", fontFamily: "var(--m)" }}
      >
        {primary.slug} ↗
      </a>
      {extra > 0 && (
        <span
          style={{
            fontSize: 9.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            background: "var(--surface-2)",
            padding: "1px 5px",
            borderRadius: 3,
            letterSpacing: ".05em",
            textTransform: "uppercase",
          }}
          title={entries.slice(1).map((e) => e.slug).join(", ")}
        >
          +{extra} more
        </span>
      )}
    </div>
  );
}

function Delta({ n }: { n: number }) {
  const color = n > 0 ? "var(--success)" : "var(--danger)";
  return (
    <span style={{ fontFamily: "var(--m)", fontSize: 11, color, fontVariantNumeric: "tabular-nums" }}>
      {n > 0 ? "+" : ""}
      {n}
    </span>
  );
}

function Header({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "14px 18px 12px",
        fontSize: 10.5,
        fontFamily: "var(--m)",
        fontWeight: 500,
        color: "var(--text-3)",
        letterSpacing: ".08em",
        textTransform: "uppercase",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {label}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "20px 14px", fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

// Mercury decard: aside flows on canvas with top + bottom hairlines; no
// outer card. History rows below the header keep their own hairline rule.
const asideStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  maxHeight: "calc(100vh - 200px)",
  borderTop: "1px solid var(--border-subtle)",
  borderBottom: "1px solid var(--border-subtle)",
  overflow: "hidden",
};

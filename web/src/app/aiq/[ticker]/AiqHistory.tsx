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
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        background: latest ? "rgba(34,211,238,.04)" : undefined,
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
                  color: dlt > 0 ? "#34D399" : "#FB7185",
                  background: dlt > 0 ? "rgba(52,211,153,.06)" : "rgba(251,113,133,.06)",
                  border: `1px solid ${dlt > 0 ? "rgba(52,211,153,.25)" : "rgba(251,113,133,.25)"}`,
                  padding: "1px 5px",
                  borderRadius: 3,
                }}
              >
                {d.label.slice(0, 4)} {dlt > 0 ? "+" : ""}
                {dlt}
              </span>
            );
          })}
        </div>
      )}
      {row.source_url && (
        <div style={{ marginTop: 6 }}>
          <a
            href={row.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10.5, color: "var(--accent)", textDecoration: "none", fontFamily: "var(--m)" }}
          >
            source ↗
          </a>
        </div>
      )}
      {row.notes && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
          {row.notes}
        </div>
      )}
    </div>
  );
}

function Delta({ n }: { n: number }) {
  const color = n > 0 ? "#34D399" : "#FB7185";
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
        padding: "12px 14px",
        fontSize: 11,
        fontFamily: "var(--m)",
        fontWeight: 500,
        color: "var(--text-3)",
        letterSpacing: ".06em",
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

const asideStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  maxHeight: "calc(100vh - 200px)",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  overflow: "hidden",
};

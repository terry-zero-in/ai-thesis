/**
 * Depreciation-extension and Burry-style overstatement flags. Only renders
 * when there's at least one flag — feature is only meaningful for L2
 * hyperscalers per the algorithm spec.
 */
import type { NameDepFlag } from "@/lib/name-detail-data";

export function DepFlagsList({ flags }: { flags: NameDepFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid rgba(251,113,133,.20)",
        borderRadius: 6,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontFamily: "var(--m)",
          color: "#FB7185",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Depreciation flags
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flags.map((f) => (
          <div
            key={f.flagged_at}
            style={{
              display: "flex",
              gap: 16,
              fontSize: 12,
              color: "var(--text-2)",
              borderBottom: "1px solid var(--border-subtle)",
              paddingBottom: 8,
            }}
          >
            <span style={{ fontFamily: "var(--m)", fontSize: 11, color: "var(--text-3)", minWidth: 84 }}>
              {f.flagged_at}
            </span>
            {f.extension_years != null && (
              <Meta label="Extension" value={`${f.extension_years.toFixed(1)} yr`} />
            )}
            {f.penalty_v != null && <Meta label="Penalty" value={String(f.penalty_v)} negative />}
            {f.burry_overstatement_pct != null && (
              <Meta label="Overstatement" value={`${f.burry_overstatement_pct.toFixed(1)}%`} />
            )}
            {f.source_url && (
              <a
                href={f.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}
              >
                source ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Meta({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</span>
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 12,
          color: negative ? "#FB7185" : "var(--text-1)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * DerivationStrip — source / period / attribution row under any computed number.
 *
 * Signature pattern per docs/design/lambo-review-2026-05-17.md §4.2 (Pattern #2).
 * Per /lambo "every computed number has a source attribution nearby ...
 * 'turnover-engine · T-1 annualized' reads like the system is showing its work."
 * Per /linear §3.3 "every number, every label, every status — hover gives
 * provenance, click gives detail."
 *
 * Renders 11px JetBrains Mono --text-3 with `·` separators between fields.
 * Drop directly beneath any cell, KPI value, factor score, or chart-today marker.
 *
 * Compact form:
 *   <DerivationStrip source="turnover-engine" period="weekly" version="v3.2" />
 *   → turnover-engine · weekly · v3.2
 *
 * Verbose form:
 *   <DerivationStrip source="scores_history" period="weekly" timestamp="2026-05-09" version="composite v2.4" />
 *   → scores_history · weekly · 2026-05-09 · composite v2.4
 *
 * Each field is optional — only non-null fields render. The `·` separators
 * are inserted between rendered fields only (no leading / trailing / orphan).
 */
interface DerivationStripProps {
  /** Producing engine / table / function name. Mono. */
  source?: string;
  /** Cadence ("weekly", "daily", "T-1 annualized", "30s polled"). */
  period?: string;
  /** Last computed-at timestamp (ISO date or "X ago" string). */
  timestamp?: string;
  /** Engine / algorithm version stamp ("v3.2", "composite v2.4"). */
  version?: string;
  /** Override base font size (default 11). Bump to 12 for hero contexts. */
  fontSize?: number;
  /** Optional CSS color override (default --text-3). Use --text-4 in dense table cells. */
  color?: string;
}

export function DerivationStrip({
  source,
  period,
  timestamp,
  version,
  fontSize = 11,
  color = "var(--text-3)",
}: DerivationStripProps) {
  const parts = [source, period, timestamp, version].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  return (
    <div
      style={{
        fontSize,
        fontFamily: "var(--m)",
        color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span style={{ margin: "0 6px", color: "var(--text-4)" }}>·</span>}
          {p}
        </span>
      ))}
    </div>
  );
}

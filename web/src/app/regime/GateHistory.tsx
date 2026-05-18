import type { GateChange } from "@/lib/regime-types";

/**
 * "Last 5 gate-state changes" list per Master Design Spec §5.5.
 *
 * Spec mockup:
 *   May 8   NAAIM crossed 90   → 0.95× from 1.00×
 *   Apr 2   F&G dropped <20    → 1.00× from 0.95×
 *   ...
 *
 * Mono timestamps, plain prose, no badges — "just receipts." Direction
 * arrow color: --warning when gate count rose (more restrictive),
 * --success when it fell (multiplier eased back toward 1.00×).
 */
export function GateHistory({ changes }: { changes: GateChange[] }) {
  if (changes.length === 0) {
    return (
      <Section>
        <Empty>No gate-state changes in the last 52 weeks.</Empty>
      </Section>
    );
  }
  const top = changes.slice(0, 5);
  return (
    <Section>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {top.map((c, i) => (
          <Row key={`${c.as_of}-${i}`} c={c} isLast={i === top.length - 1} />
        ))}
      </div>
    </Section>
  );
}

function Row({ c, isLast }: { c: GateChange; isLast: boolean }) {
  const tightened = c.current_gates > c.prior_gates;
  const arrowColor = tightened ? "var(--warning)" : "var(--success)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "84px 1fr auto",
        gap: 16,
        alignItems: "baseline",
        padding: "10px 0",
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        fontFamily: "var(--m)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: ".02em",
        }}
      >
        {fmtDate(c.as_of)}
      </span>
      <span
        style={{
          fontSize: 12.5,
          color: "var(--text-2)",
          lineHeight: 1.45,
        }}
      >
        {c.cause_label || `${c.current_gates} of 3 gates hit`}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--text-2)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: "var(--text-3)" }}>{c.prior_multiplier.toFixed(2)}×</span>
        <span style={{ color: arrowColor, fontWeight: 600 }}>→</span>
        <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{c.current_multiplier.toFixed(2)}×</span>
      </span>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 10.5,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          paddingBottom: 10,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        History · last 5 gate-state changes
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "var(--text-3)", padding: "10px 0" }}>{children}</div>;
}

function fmtDate(as_of: string): string {
  // 2026-05-14 → "May 14"
  const m = as_of.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return as_of;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mo = months[parseInt(m[2], 10) - 1] ?? m[2];
  const day = parseInt(m[3], 10);
  return `${mo} ${day}`;
}

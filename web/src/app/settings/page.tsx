import { getSettingsSnapshot, type CronJob, type FreshnessRow } from "@/lib/settings-data";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NoRail } from "@/components/shell/NoRail";
import { PageHeader } from "@/components/primitives/PageHeader";

/**
 * Read-only operator settings. Refreshes every 5 min — pipeline freshness
 * is the time-sensitive signal here, so 5 min keeps the staleness display
 * usable without hammering the DB.
 */
export const revalidate = 300;

export default async function SettingsPage() {
  const snap = await getSettingsSnapshot();
  const sb = await getSupabaseServer();
  const { data: userData } = sb ? await sb.auth.getUser() : { data: { user: null } };
  const email = userData?.user?.email ?? null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NoRail />
      <PageHeader
        title="Settings"
        subtitle="Operator view · cron registry + pipeline freshness"
      />

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 28px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <Section label="Account">
          <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.65 }}>
            {email ? (
              <>
                Signed in as <span style={{ fontFamily: "var(--m)", color: "var(--text-1)" }}>{email}</span>.
                Single-tenant v1 — only the authenticated email can read or write any surface.
              </>
            ) : (
              <>Sample workspace — sign in to use real data and enable writes.</>
            )}
          </div>
        </Section>

        <Section label="Pipeline freshness">
          <FreshnessTable rows={snap.freshness} envConfigured={snap.envConfigured} />
        </Section>

        <Section label="Cron registry">
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, lineHeight: 1.5 }}>
            Mirrors <code style={{ fontFamily: "var(--m)" }}>supabase/migrations/*_cron.sql</code>. All times UTC.
            pg_cron job table is not queryable via the anon role, so this is a hand-maintained registry — keep in sync with migrations.
          </div>
          <CronTable jobs={snap.cron} />
        </Section>

      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        padding: "14px 18px 16px",
        background: "var(--surface-1)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          color: "var(--text-3)",
          fontFamily: "var(--m)",
        }}
      >
        {label}
      </div>
      {children}
    </section>
  );
}

function FreshnessTable({ rows, envConfigured }: { rows: FreshnessRow[]; envConfigured: boolean }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontFamily: "var(--m)" }}>
      <thead>
        <tr>
          <Th align="left">Surface</Th>
          <Th align="left">Table.column</Th>
          <Th>Latest</Th>
          <Th>Age (h)</Th>
          <Th>SLA</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const status = !envConfigured
            ? { color: "var(--text-3)", text: "—" }
            : r.staleHours == null
              ? { color: "var(--danger)", text: "no data" }
              : r.staleHours > r.expectedHours
                ? { color: "var(--warning)", text: "stale" }
                : { color: "var(--success)", text: "fresh" };
          return (
            <tr key={r.table} style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <Td align="left">{r.label}</Td>
              <Td align="left" muted>{r.table}.{r.column}</Td>
              <Td muted>{r.latest ?? "—"}</Td>
              <Td muted>{r.staleHours == null ? "—" : r.staleHours.toFixed(1)}</Td>
              <Td muted>≤{r.expectedHours}h</Td>
              <Td><span style={{ color: status.color }}>{status.text}</span></Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CronTable({ jobs }: { jobs: CronJob[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontFamily: "var(--m)" }}>
      <thead>
        <tr>
          <Th align="left">Job</Th>
          <Th align="left">Function</Th>
          <Th align="left">Schedule (cron)</Th>
          <Th align="left">Cadence</Th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((j) => (
          <tr key={j.jobname} style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <Td align="left">{j.jobname}</Td>
            <Td align="left" muted>{j.fn}</Td>
            <Td align="left" muted>{j.schedule}</Td>
            <Td align="left" muted>{j.cadence}{j.notes ? ` — ${j.notes}` : ""}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children, align = "right" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 12px",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: ".08em",
        color: "var(--text-3)",
        fontWeight: 500,
        borderBottom: "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "right", muted = false }: { children?: React.ReactNode; align?: "left" | "right"; muted?: boolean }) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "8px 12px",
        color: muted ? "var(--text-2)" : "var(--text-1)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

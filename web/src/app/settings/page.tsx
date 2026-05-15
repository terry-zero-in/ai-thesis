import { PageStub } from "@/components/primitives/PageStub";

export default function SettingsPage() {
  return (
    <PageStub
      title="Settings"
      intent="Account, ingestion config, theme. Per-environment Supabase / FMP / cron secrets are server-side only and not surfaced here."
      bullets={[
        "Account: email + sign-out (single-tenant: Terry only)",
        "Theme: palette picker (mirrors the topbar swatch)",
        "Ingestion: cron schedules (read-only display of pg_cron jobs)",
        "Pipeline freshness check (last successful run per job)",
      ]}
    />
  );
}

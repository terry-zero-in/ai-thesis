import { PageStub } from "@/components/primitives/PageStub";

export default function UniversePage() {
  return (
    <PageStub
      title="Universe"
      intent="Sortable / filterable table of every scored name. Layer × tier filters, virtualized rows, drill into per-name detail. Routines/Delegations row treatment from Reticle is the visual reference."
      bullets={[
        "All 50 names — composite, tier badge, layer chip, Q/G/V/AIQ mini-bars",
        "Sortable columns; sticky header; <500ms initial load",
        "Filter chips in right rail (layer + tier)",
        "Row click → per-name detail (THS-53)",
        "Prior-week delta + macro flag column",
      ]}
    />
  );
}

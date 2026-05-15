import { PageStub } from "@/components/primitives/PageStub";

export default function AiqPage() {
  return (
    <PageStub
      title="AIQ Editor"
      intent="Hand-scored AIQ rubric: six dimensions per ticker (Disclosure 20 · Defensibility 20 · Concentration 15 · Capex efficiency 15 · Independent demand 15 · Accounting 15) → total. Inline edit, optimistic update, audit row per change."
      bullets={[
        "Per-ticker row with six dimension cells + computed total",
        "Click-to-edit cell with keyboard step (↑/↓ for ±1)",
        "Audit log: who changed what, when, prior value",
        "Filter by layer; sort by total or any dimension",
        "Quarterly re-score reminder banner",
      ]}
    />
  );
}

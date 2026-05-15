import { PageStub } from "@/components/primitives/PageStub";

export default function DecisionsPage() {
  return (
    <PageStub
      title="Decisions"
      intent="Buy / sell / hold history — every decision tied to the memo and composite that triggered it. Reticle Delegations row treatment is the visual reference."
      bullets={[
        "Row per decision: ticker · action · size · date · trigger memo",
        "Composite at decision time + composite today (with delta)",
        "Filter by action type, ticker, layer",
        "Outcome tag once realized P/L is computable",
      ]}
    />
  );
}

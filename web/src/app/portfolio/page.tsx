import { PageStub } from "@/components/primitives/PageStub";

export default function PortfolioPage() {
  return (
    <PageStub
      title="Portfolio"
      intent="$100K live book with cost basis, position weights, returns, and factor exposure rollups. Basis Proforma canvas density is the visual reference."
      bullets={[
        "Position table: ticker · weight · cost · mark · unrealized P/L",
        "Factor exposure rollup (Q/G/V/AIQ-weighted across the book)",
        "Layer concentration bars (% of book in L1/L2/L3/L4/L5)",
        "Cash + reserve position",
        "Manual cost-basis entry for v1",
      ]}
    />
  );
}

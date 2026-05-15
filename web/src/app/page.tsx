import { PageStub } from "@/components/primitives/PageStub";

export default function DashboardPage() {
  return (
    <PageStub
      title="Weekly snapshot"
      intent="Dashboard surface — at-a-glance state of this week's run: tier movement, macro multiplier, watchlist deltas, and any names that crossed a tier boundary since last Saturday."
      bullets={[
        "Tier counts (High / Medium / Low / Avoid) and the +/- change vs prior week",
        "Macro gauge state: NAAIM, AAII 3wk, F&G + active multiplier",
        "Top movers by composite delta (winners + losers since last run)",
        "Names that crossed a tier boundary this week",
        "Pipeline freshness: last run timestamps for ingest + scoring jobs",
      ]}
    />
  );
}

import { PageStub } from "@/components/primitives/PageStub";

export default function RegimePage() {
  return (
    <PageStub
      title="Regime"
      intent="Macro gauges (NAAIM, AAII bull-bear 3wk, CNN Fear & Greed) + active multiplier state + history. Investment Portal macro-gauge tile is the visual reference."
      bullets={[
        "Three live gauges: NAAIM (>90 = gate), AAII 3wk (>30), F&G (>80)",
        "Current multiplier (1.0 / 0.95 / 0.90 / 0.85) + gates-hit count",
        "Historical timeline (12 months) with tier-de-rate annotations",
        "Threshold lines + at-or-above-threshold shading",
        "Source attribution + last-fetch timestamp per gauge",
      ]}
    />
  );
}

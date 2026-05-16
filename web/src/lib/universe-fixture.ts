/**
 * Universe fixture — the 50 hand-curated seed names, keyed off
 * `supabase/migrations/20260515000200_e13_seed_universe.sql`. Used by the
 * /universe table fetcher and the /universe/[ticker] detail fetcher to
 * keep the page renderable during dev when no Supabase project is
 * configured (or when the DB is empty pre-Saturday-cron).
 *
 * If the seed migration changes, mirror it here.
 */
export interface SeedRow {
  ticker: string;
  name: string;
  layer: number;
  layer_label: string;
}

export const FIXTURE_UNIVERSE: SeedRow[] = [
  // L1 Compute (14)
  { ticker: "NVDA", name: "NVIDIA", layer: 1, layer_label: "Compute" },
  { ticker: "AVGO", name: "Broadcom", layer: 1, layer_label: "Compute" },
  { ticker: "AMD", name: "Advanced Micro Devices", layer: 1, layer_label: "Compute" },
  { ticker: "TSM", name: "Taiwan Semiconductor Manufacturing", layer: 1, layer_label: "Compute" },
  { ticker: "ASML", name: "ASML Holding", layer: 1, layer_label: "Compute" },
  { ticker: "AMAT", name: "Applied Materials", layer: 1, layer_label: "Compute" },
  { ticker: "LRCX", name: "Lam Research", layer: 1, layer_label: "Compute" },
  { ticker: "KLAC", name: "KLA Corporation", layer: 1, layer_label: "Compute" },
  { ticker: "MRVL", name: "Marvell Technology", layer: 1, layer_label: "Compute" },
  { ticker: "ARM", name: "Arm Holdings", layer: 1, layer_label: "Compute" },
  { ticker: "SNPS", name: "Synopsys", layer: 1, layer_label: "Compute" },
  { ticker: "CDNS", name: "Cadence Design Systems", layer: 1, layer_label: "Compute" },
  { ticker: "MU", name: "Micron Technology", layer: 1, layer_label: "Compute" },
  { ticker: "ANET", name: "Arista Networks", layer: 1, layer_label: "Compute" },
  // L2 Hyperscaler (7)
  { ticker: "MSFT", name: "Microsoft", layer: 2, layer_label: "Hyperscaler" },
  { ticker: "GOOGL", name: "Alphabet", layer: 2, layer_label: "Hyperscaler" },
  { ticker: "AMZN", name: "Amazon", layer: 2, layer_label: "Hyperscaler" },
  { ticker: "META", name: "Meta Platforms", layer: 2, layer_label: "Hyperscaler" },
  { ticker: "ORCL", name: "Oracle", layer: 2, layer_label: "Hyperscaler" },
  { ticker: "IBM", name: "IBM", layer: 2, layer_label: "Hyperscaler" },
  { ticker: "CRM", name: "Salesforce", layer: 2, layer_label: "Hyperscaler" },
  // L3 App (9)
  { ticker: "PLTR", name: "Palantir Technologies", layer: 3, layer_label: "App" },
  { ticker: "SNOW", name: "Snowflake", layer: 3, layer_label: "App" },
  { ticker: "CRWD", name: "CrowdStrike Holdings", layer: 3, layer_label: "App" },
  { ticker: "S", name: "SentinelOne", layer: 3, layer_label: "App" },
  { ticker: "DDOG", name: "Datadog", layer: 3, layer_label: "App" },
  { ticker: "MDB", name: "MongoDB", layer: 3, layer_label: "App" },
  { ticker: "NET", name: "Cloudflare", layer: 3, layer_label: "App" },
  { ticker: "ESTC", name: "Elastic", layer: 3, layer_label: "App" },
  { ticker: "AI", name: "C3.ai", layer: 3, layer_label: "App" },
  // L4 Power (14)
  { ticker: "VST", name: "Vistra", layer: 4, layer_label: "Power" },
  { ticker: "CEG", name: "Constellation Energy", layer: 4, layer_label: "Power" },
  { ticker: "NRG", name: "NRG Energy", layer: 4, layer_label: "Power" },
  { ticker: "TLN", name: "Talen Energy", layer: 4, layer_label: "Power" },
  { ticker: "PWR", name: "Quanta Services", layer: 4, layer_label: "Power" },
  { ticker: "ETN", name: "Eaton", layer: 4, layer_label: "Power" },
  { ticker: "PH", name: "Parker-Hannifin", layer: 4, layer_label: "Power" },
  { ticker: "VRT", name: "Vertiv Holdings", layer: 4, layer_label: "Power" },
  { ticker: "GEV", name: "GE Vernova", layer: 4, layer_label: "Power" },
  { ticker: "TT", name: "Trane Technologies", layer: 4, layer_label: "Power" },
  { ticker: "JCI", name: "Johnson Controls", layer: 4, layer_label: "Power" },
  { ticker: "POWL", name: "Powell Industries", layer: 4, layer_label: "Power" },
  { ticker: "HUBB", name: "Hubbell", layer: 4, layer_label: "Power" },
  { ticker: "NEE", name: "NextEra Energy", layer: 4, layer_label: "Power" },
  // L5 Incumbent (6)
  { ticker: "AAPL", name: "Apple", layer: 5, layer_label: "Incumbent" },
  { ticker: "TSLA", name: "Tesla", layer: 5, layer_label: "Incumbent" },
  { ticker: "ADBE", name: "Adobe", layer: 5, layer_label: "Incumbent" },
  { ticker: "INTC", name: "Intel", layer: 5, layer_label: "Incumbent" },
  { ticker: "QCOM", name: "Qualcomm", layer: 5, layer_label: "Incumbent" },
  { ticker: "TXN", name: "Texas Instruments", layer: 5, layer_label: "Incumbent" },
];

export const FIXTURE_INDEX: Record<string, SeedRow> = Object.fromEntries(
  FIXTURE_UNIVERSE.map((u) => [u.ticker, u]),
);

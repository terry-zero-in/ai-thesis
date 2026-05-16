/**
 * Universe table data fetcher.
 *
 * Returns one row per active investable ticker, joined to the latest
 * `scores_history` row (most recent `as_of`). When the DB is empty (pre-cron
 * dev) or Supabase env is unset, falls back to a fixture so the page still
 * renders. Fixture is keyed off the real seed (`20260515000200_e13_seed_universe.sql`)
 * with synthesized scores; clearly flagged in the return shape via `synthetic`.
 *
 * Source tables:
 *   - public.universe (ticker, name, layer, layer_label, is_active)
 *   - public.scores_history (q_score, g_score, v_score, aiq_score, composite,
 *       final_score, tier, macro_gates_hit, macro_multiplier, as_of)
 *
 * The `prior_composite` field is the second-most-recent composite for the
 * same ticker (used to render a week-over-week delta column).
 */
import { getSupabaseBrowser } from "./supabase/client";

export type Tier = "High" | "Medium" | "Low" | "Avoid";

export interface UniverseRow {
  ticker: string;
  name: string;
  layer: number;
  layer_label: string;
  composite: number | null;
  final_score: number | null;
  tier: Tier | null;
  q: number | null;
  g: number | null;
  v: number | null;
  aiq: number | null;
  prior_composite: number | null;
  delta: number | null;
  macro_gates_hit: number;
  macro_multiplier: number;
  as_of: string | null;
}

export interface UniverseSnapshot {
  rows: UniverseRow[];
  asOf: string | null;
  synthetic: boolean;
}

interface ScoresRow {
  ticker: string;
  as_of: string;
  q_score: number | null;
  g_score: number | null;
  v_score: number | null;
  aiq_score: number | null;
  composite: number | null;
  final_score: number | null;
  tier: Tier | null;
  macro_gates_hit: number;
  macro_multiplier: number;
}

interface UniverseDbRow {
  ticker: string;
  name: string;
  layer: number;
  layer_label: string;
}

export async function getLatestUniverseScores(): Promise<UniverseSnapshot> {
  const sb = getSupabaseBrowser();
  if (!sb) return fixtureSnapshot();

  const { data: universe, error: ue } = await sb
    .from("universe")
    .select("ticker,name,layer,layer_label")
    .eq("is_active", true)
    .order("ticker");
  if (ue || !universe || universe.length === 0) return fixtureSnapshot();

  const { data: scores, error: se } = await sb
    .from("scores_history")
    .select(
      "ticker,as_of,q_score,g_score,v_score,aiq_score,composite,final_score,tier,macro_gates_hit,macro_multiplier",
    )
    .order("as_of", { ascending: false })
    .limit(universe.length * 8); // ~2 weeks of history per name is plenty for latest + prior
  if (se || !scores || scores.length === 0) return fixtureSnapshot();

  return buildSnapshot(universe as UniverseDbRow[], scores as ScoresRow[]);
}

function buildSnapshot(universe: UniverseDbRow[], scores: ScoresRow[]): UniverseSnapshot {
  // Group history descending per ticker so [0] is latest, [1] is prior.
  const byTicker = new Map<string, ScoresRow[]>();
  for (const s of scores) {
    const list = byTicker.get(s.ticker) ?? [];
    list.push(s);
    byTicker.set(s.ticker, list);
  }
  let maxAsOf: string | null = null;
  const rows: UniverseRow[] = universe.map((u) => {
    const hist = byTicker.get(u.ticker) ?? [];
    const latest = hist[0];
    const prior = hist[1];
    if (latest && (!maxAsOf || latest.as_of > maxAsOf)) maxAsOf = latest.as_of;
    return {
      ticker: u.ticker,
      name: u.name,
      layer: u.layer,
      layer_label: u.layer_label,
      composite: latest?.composite ?? null,
      final_score: latest?.final_score ?? null,
      tier: latest?.tier ?? null,
      q: latest?.q_score ?? null,
      g: latest?.g_score ?? null,
      v: latest?.v_score ?? null,
      aiq: latest?.aiq_score ?? null,
      prior_composite: prior?.composite ?? null,
      delta:
        latest?.composite != null && prior?.composite != null
          ? Number((latest.composite - prior.composite).toFixed(2))
          : null,
      macro_gates_hit: latest?.macro_gates_hit ?? 0,
      macro_multiplier: latest?.macro_multiplier ?? 1.0,
      as_of: latest?.as_of ?? null,
    };
  });
  return { rows, asOf: maxAsOf, synthetic: false };
}

// ---------------------------------------------------------------------------
// Fixture — deterministic synthesized scores keyed off the seed universe.
// Replaced by live data once the Saturday cron runs against a deployed project.
// ---------------------------------------------------------------------------
function fixtureSnapshot(): UniverseSnapshot {
  const seed = FIXTURE_UNIVERSE.map((u, i) => {
    const baseQ = 55 + ((i * 7) % 40);
    const baseG = 50 + ((i * 11) % 45);
    const baseV = 45 + ((i * 13) % 50);
    const baseAiq = 50 + ((i * 5) % 45);
    const composite = Math.round(
      ((baseQ + baseG + baseV + baseAiq) / 4 + (u.layer === 1 ? 5 : 0)) * 10,
    ) / 10;
    const macroMult = i % 9 === 0 ? 0.95 : 1.0;
    const gates = macroMult < 1 ? 1 : 0;
    const final = Math.round(composite * macroMult * 10) / 10;
    const tier: Tier = final >= 85 ? "High" : final >= 75 ? "Medium" : final >= 60 ? "Low" : "Avoid";
    const prior = Math.round((composite - ((i % 5) - 2) * 0.8) * 10) / 10;
    return {
      ticker: u.ticker,
      name: u.name,
      layer: u.layer,
      layer_label: u.layer_label,
      composite,
      final_score: final,
      tier,
      q: baseQ,
      g: baseG,
      v: baseV,
      aiq: baseAiq,
      prior_composite: prior,
      delta: Math.round((composite - prior) * 10) / 10,
      macro_gates_hit: gates,
      macro_multiplier: macroMult,
      as_of: "2026-05-09",
    };
  });
  return { rows: seed, asOf: "2026-05-09", synthetic: true };
}

const FIXTURE_UNIVERSE: UniverseDbRow[] = [
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

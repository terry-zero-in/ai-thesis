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
import { FIXTURE_UNIVERSE } from "./universe-fixture";
import { classifyTier } from "./scoring-weights";

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
  prior_q: number | null;
  prior_g: number | null;
  prior_v: number | null;
  prior_aiq: number | null;
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
  /**
   * Set of tickers currently in aiq_draft_queue (status='queued'|'processing').
   * UI decorates these rows with a "Queued" badge — operator sees which names
   * are waiting on the next daily-batch Routine fire. Empty array pre-Routines.
   */
  queuedTickers: string[];
}

export interface ScoresRow {
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

export interface UniverseDbRow {
  ticker: string;
  name: string;
  layer: number;
  layer_label: string;
}

/**
 * Lean tickers-only fetcher for the name-detail prev/next pager. Single
 * query, alphabetical (matches the universe table's natural order and the
 * fixture seed ordering). Falls back to FIXTURE_UNIVERSE tickers when env
 * is unset so the pager renders in dev.
 */
export async function getUniverseTickers(): Promise<string[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return FIXTURE_UNIVERSE.map((u) => u.ticker).sort();
  const { data, error } = await sb
    .from("universe")
    .select("ticker")
    .eq("is_active", true)
    .order("ticker");
  if (error || !data || data.length === 0) return FIXTURE_UNIVERSE.map((u) => u.ticker).sort();
  return (data as Array<{ ticker: string }>).map((r) => r.ticker);
}

export async function getLatestUniverseScores(): Promise<UniverseSnapshot> {
  const sb = getSupabaseBrowser();
  if (!sb) return fixtureSnapshot();

  const [universeRes, scoresRes, queueRes] = await Promise.all([
    sb.from("universe").select("ticker,name,layer,layer_label").eq("is_active", true).order("ticker"),
    sb
      .from("scores_history")
      .select("ticker,as_of,q_score,g_score,v_score,aiq_score,composite,final_score,tier,macro_gates_hit,macro_multiplier")
      .order("as_of", { ascending: false })
      .limit(400), // ~50 names × 8 history rows; safe upper bound when universe count is unknown
    sb.from("aiq_draft_queue").select("ticker").in("status", ["queued", "processing"]),
  ]);

  const { data: universe, error: ue } = universeRes;
  const { data: scores, error: se } = scoresRes;
  const { data: queue } = queueRes; // queue errors are non-fatal — render scores without badges
  if (ue || !universe || universe.length === 0) return fixtureSnapshot();
  if (se || !scores || scores.length === 0) return fixtureSnapshot();

  const queuedTickers = (queue ?? []).map((r) => r.ticker as string);
  return { ...buildSnapshot(universe as UniverseDbRow[], scores as ScoresRow[]), queuedTickers };
}

export function buildSnapshot(universe: UniverseDbRow[], scores: ScoresRow[]): UniverseSnapshot {
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
      prior_q: prior?.q_score ?? null,
      prior_g: prior?.g_score ?? null,
      prior_v: prior?.v_score ?? null,
      prior_aiq: prior?.aiq_score ?? null,
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
  return { rows, asOf: maxAsOf, synthetic: false, queuedTickers: [] };
}

// ---------------------------------------------------------------------------
// Fixture — deterministic synthesized scores keyed off the seed universe.
// Replaced by live data once the Saturday cron runs against a deployed project.
// ---------------------------------------------------------------------------
export function fixtureSnapshot(): UniverseSnapshot {
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
    // Use the canonical spec cutoffs (75/60/45 — scoring-weights.ts:60). The
    // inline ternary here previously used 85/75/60 — a +10 drift that silently
    // shifted every fixture row one band lower than spec. Hit on /universe
    // review 2026-05-19 (MU at 79.7 rendered Medium here, High elsewhere).
    const tier: Tier = classifyTier(final);
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
      prior_q: baseQ - ((i % 5) - 2),
      prior_g: baseG - ((i % 4) - 1),
      prior_v: baseV - ((i % 3) - 1),
      prior_aiq: baseAiq,
      prior_composite: prior,
      delta: Math.round((composite - prior) * 10) / 10,
      macro_gates_hit: gates,
      macro_multiplier: macroMult,
      as_of: "2026-05-09",
    };
  });
  return { rows: seed, asOf: "2026-05-09", synthetic: true, queuedTickers: [] };
}


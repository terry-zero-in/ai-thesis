/**
 * Score Math derivation — THS-73 sub-pattern #2.
 *
 * Builds a single `ScoreMath` object for one ticker, derived end-to-end
 * from prod tables:
 *   - scores_history          → latest factor breakdown + composite
 *   - concentration_history   → concentration tax row (additive)
 *   - depreciation_flags      → most-recent penalty_v + extension_years
 *   - macro_gauges            → multiplier + gates hit (joined via
 *                                scores_history.macro_gates_hit which the
 *                                engine already resolved against the same
 *                                week's gauges)
 *
 * Math reconciliation (within ±0.1, per spec):
 *   composite_taxed = composite + concentration_tax     // tax is negative
 *   final_score     = (composite_taxed ≥ 75)
 *                       ? composite_taxed × macro_multiplier
 *                       : composite_taxed
 *
 * Depreciation penalty is informational (already baked into V via
 * compute_v_score per docs/AI-Thesis-v2-Algorithm-and-Deployment.md §Fix 5),
 * NOT a separate additive term. The drawer surfaces it under "already in V"
 * so the operator sees both the raw V score AND the penalty embedded in it.
 *
 * Tier classification:
 *   final_score ≥ 75 → High
 *               ≥ 60 → Medium
 *               ≥ 45 → Low
 *               <    → Avoid
 */
import { getSupabaseServer } from "./supabase/server";
import { classifyTier, type LayerCode } from "./scoring-weights";

export interface ScoreMathRow {
  ticker: string;
  /** Layer code 1..5, or null if the ticker is unknown / outside universe. */
  layer: number | null;
  /** Display label for the layer. */
  layerLabel: string;
  /** Raw factor scores (0..100 each). null when the engine hasn't scored. */
  q: number | null;
  g: number | null;
  v: number | null;
  aiq: number | null;
  /** Engine-computed weighted Tier-A composite (pre-tax, pre-multiplier). */
  composite: number | null;
  /** Concentration-tax dollar value applied additively (negative). */
  concentrationTax: number;
  /** Most-recent depreciation v_penalty (negative, already inside `v`). */
  depreciationPenalty: number | null;
  /** True when a depreciation_flags row exists for this ticker. */
  depreciationFlagged: boolean;
  /** Macro multiplier (0.85..1.00) applied at composite ≥ 75 only. */
  macroMultiplier: number;
  /** Number of macro gates hit (0..3). */
  macroGatesHit: number;
  /** Engine-computed final score after tax + multiplier. */
  finalScore: number | null;
  /** Tier classification from finalScore (cutpoints in scoring-weights.ts). */
  tier: "High" | "Medium" | "Low" | "Avoid" | null;
  /** Latest scores_history.as_of for this ticker. */
  asOf: string | null;
  /** Latest concentration_history.as_of for this ticker. */
  concentrationAsOf: string | null;
  /** Most-recent depreciation_flags.flagged_at for this ticker. */
  depreciationFlaggedAt: string | null;
  /** True when at least the universe row was found. */
  found: boolean;
}

/**
 * Fetch a single ticker's full score derivation. Returns `found: false`
 * when the ticker isn't in the universe. Tables that have no row for the
 * ticker fall back to neutral defaults (tax=0, depreciation=null) so the
 * drawer renders cleanly even when overlays haven't fired yet.
 */
export async function getScoreMath(ticker: string): Promise<ScoreMathRow> {
  const t = ticker.toUpperCase();
  const sb = await getSupabaseServer();
  if (!sb) return emptyScoreMath(t);

  const [universeRes, scoresRes, concRes, depRes] = await Promise.all([
    sb
      .from("universe")
      .select("ticker,layer,layer_label")
      .eq("ticker", t)
      .maybeSingle(),
    sb
      .from("scores_history")
      .select(
        "as_of,q_score,g_score,v_score,v_penalty,aiq_score,composite,final_score,tier,macro_gates_hit,macro_multiplier",
      )
      .eq("ticker", t)
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("concentration_history")
      .select("as_of,tax")
      .eq("ticker", t)
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("depreciation_flags")
      .select("flagged_at,penalty_v,extension_years")
      .eq("ticker", t)
      .order("flagged_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const u = universeRes.data as { ticker: string; layer: number; layer_label: string } | null;
  if (!u) return emptyScoreMath(t);

  const s = scoresRes.data as {
    as_of: string;
    q_score: number | null;
    g_score: number | null;
    v_score: number | null;
    v_penalty: number | null;
    aiq_score: number | null;
    composite: number | null;
    final_score: number | null;
    tier: "High" | "Medium" | "Low" | "Avoid" | null;
    macro_gates_hit: number;
    macro_multiplier: number;
  } | null;
  const conc = concRes.data as { as_of: string; tax: number } | null;
  const dep = depRes.data as { flagged_at: string; penalty_v: number | null; extension_years: number | null } | null;

  // The composite stored in scores_history is the post-(tax + multiplier) value
  // when the engine writes "composite" the way compute_composite_scores does
  // — actually scores_history.composite is the PRE-tax value (see composite.ts),
  // so use it directly. final_score is the post-everything value.
  return {
    ticker: t,
    layer: u.layer,
    layerLabel: u.layer_label,
    q: s?.q_score ?? null,
    g: s?.g_score ?? null,
    v: s?.v_score ?? null,
    aiq: s?.aiq_score ?? null,
    composite: s?.composite ?? null,
    concentrationTax: conc?.tax ?? 0,
    depreciationPenalty: dep?.penalty_v ?? (s?.v_penalty ?? null),
    depreciationFlagged: dep != null,
    macroMultiplier: s?.macro_multiplier ?? 1.0,
    macroGatesHit: s?.macro_gates_hit ?? 0,
    finalScore: s?.final_score ?? null,
    tier: s?.tier ?? (s?.final_score != null ? classifyTier(s.final_score) : null),
    asOf: s?.as_of ?? null,
    concentrationAsOf: conc?.as_of ?? null,
    depreciationFlaggedAt: dep?.flagged_at ?? null,
    found: true,
  };
}

function emptyScoreMath(ticker: string): ScoreMathRow {
  return {
    ticker,
    layer: null,
    layerLabel: "—",
    q: null,
    g: null,
    v: null,
    aiq: null,
    composite: null,
    concentrationTax: 0,
    depreciationPenalty: null,
    depreciationFlagged: false,
    macroMultiplier: 1.0,
    macroGatesHit: 0,
    finalScore: null,
    tier: null,
    asOf: null,
    concentrationAsOf: null,
    depreciationFlaggedAt: null,
    found: false,
  };
}

/**
 * Reconcile final_score from the derivation rows. Mirrors the engine
 * arithmetic in `composite.ts`. Useful for the drawer's "derived"
 * annotation so the math is verifiable on screen.
 */
export function deriveFinalScore(row: ScoreMathRow): number | null {
  if (row.composite == null) return null;
  const taxed = row.composite + (row.concentrationTax ?? 0);
  return taxed >= 75 ? taxed * row.macroMultiplier : taxed;
}

/** Convenience type re-export for layer code casting in UI consumers. */
export type { LayerCode };

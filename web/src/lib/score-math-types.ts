/**
 * Client-safe types and pure derivations for Score Math — THS-73.
 *
 * Split from `score-math.ts` so client components (ScoreMathDrawer) can
 * import `ScoreMathRow` + `deriveFinalScore` without pulling the
 * server-only `next/headers` dependency into the browser bundle.
 *
 * Server fetcher lives in `./score-math.ts` and re-exports these types
 * so existing server-side callers (page.tsx, ScoreMathDrawerAsync) keep
 * working unchanged.
 */
import type { LayerCode } from "./scoring-weights";

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
 * Reconcile final_score from the derivation rows. Mirrors the engine
 * arithmetic in `composite.ts`. Useful for the drawer's "derived"
 * annotation so the math is verifiable on screen.
 */
export function deriveFinalScore(row: ScoreMathRow): number | null {
  if (row.composite == null) return null;
  const taxed = row.composite + (row.concentrationTax ?? 0);
  return taxed >= 75 ? taxed * row.macroMultiplier : taxed;
}

export type { LayerCode };

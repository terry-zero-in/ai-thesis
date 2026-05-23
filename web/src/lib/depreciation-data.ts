/**
 * Server-side helpers for the depreciation_flags overlay table.
 *
 * Used by:
 *   - Today's Thesis card (THS-74) — surfaces "avoid highest deprec-risk
 *     hyperscaler" when one is currently held.
 *
 * `penalty_v` is the per-ticker V-score penalty (a NEGATIVE integer in
 * the schema, e.g. -5, -8). "Heaviest" = MOST negative. Ties broken by
 * most-recent `flagged_at`.
 */
import { getSupabaseServer } from "./supabase/server";

interface DepRow {
  ticker: string;
  flagged_at: string;
  penalty_v: number | null;
}

/**
 * Find the held ticker (subset of `heldTickers`) with the heaviest
 * `depreciation_flags.penalty_v` (= most negative). Returns null when
 * either no held names are flagged or no held tickers were passed.
 *
 * Pulls only flags for the held set in a single round-trip; latest row
 * per ticker is taken via in-memory dedupe (no DISTINCT ON in JS supabase
 * client). Empty array input short-circuits before the query.
 */
export async function getHighestDeprecRiskHyperscalerHeld(
  heldTickers: string[],
): Promise<string | null> {
  if (heldTickers.length === 0) return null;
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data } = await sb
    .from("depreciation_flags")
    .select("ticker,flagged_at,penalty_v")
    .in("ticker", heldTickers)
    .order("flagged_at", { ascending: false });
  const rows = (data ?? []) as DepRow[];
  if (rows.length === 0) return null;

  // Most-recent flag per ticker — rows are date-desc so first occurrence wins.
  const latest = new Map<string, DepRow>();
  for (const r of rows) {
    if (!latest.has(r.ticker)) latest.set(r.ticker, r);
  }

  let bestTicker: string | null = null;
  let bestPenalty = 0; // penalty_v is negative; 0 means "no penalty yet"
  for (const r of latest.values()) {
    if (r.penalty_v == null) continue;
    if (r.penalty_v < bestPenalty) {
      bestPenalty = r.penalty_v;
      bestTicker = r.ticker;
    }
  }
  return bestTicker;
}

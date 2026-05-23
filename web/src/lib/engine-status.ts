/**
 * Engine-status sitewide metadata strip — THS-73 sub-pattern #1.
 *
 * One server-side helper returns the freshness state of every data source
 * that drives the analytical surfaces. Each segment is rendered by
 * `<EngineStatusStrip />` near the top of every page.
 *
 * Source mapping:
 *   - as_of  = latest scores_history.as_of (the canonical "what week is this?")
 *   - prices = max(prices_raw.as_of)
 *   - macro  = max(macro_gauges.as_of)
 *   - AIQ    = max(aiq_rubric.scored_at)
 *   - engine = static constant (`v1.0`) until the engine writes its own
 *              version into scores_history.layer_weights
 *   - mode   = static "Tier-A Composite" until additional modes (e.g.,
 *              full six-factor when M+S live) get a mode switch
 *
 * Returns `null`-tolerant fields — a fresh dev environment with no data
 * in a table returns `null` and the strip renders an em-dash for that
 * segment instead of crashing.
 *
 * Caching: this is a server-side helper called from each page's RSC
 * tree. Each page already declares its own `export const revalidate`,
 * so this single helper inherits the per-page ISR cadence. No need to
 * memoize at this layer.
 */
import { getSupabaseServer } from "./supabase/server";

export interface EngineStatus {
  asOf: string | null;
  prices: string | null;
  macro: string | null;
  aiq: string | null;
  engineVersion: string;
  mode: string;
  /** True when at least one table responded with data (RLS / auth ok). */
  hasData: boolean;
}

const ENGINE_VERSION = "v1.0";
const ENGINE_MODE = "Tier-A Composite";

export async function getEngineStatus(): Promise<EngineStatus> {
  const sb = await getSupabaseServer();
  if (!sb) return emptyStatus();

  // Parallel one-row-each fetches. Each query asks the DB for max(date)
  // via order+limit; cheap on indexed columns. Errors are non-fatal —
  // a single missing table returns null for that segment, the rest
  // still render.
  const [scoresRes, pricesRes, macroRes, aiqRes] = await Promise.all([
    sb
      .from("scores_history")
      .select("as_of")
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("prices_raw")
      .select("as_of")
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("macro_gauges")
      .select("as_of")
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("aiq_rubric")
      .select("scored_at")
      .order("scored_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const asOf = (scoresRes.data as { as_of?: string } | null)?.as_of ?? null;
  const prices = (pricesRes.data as { as_of?: string } | null)?.as_of ?? null;
  const macro = (macroRes.data as { as_of?: string } | null)?.as_of ?? null;
  const aiq = (aiqRes.data as { scored_at?: string } | null)?.scored_at ?? null;

  return {
    asOf,
    prices,
    macro,
    aiq,
    engineVersion: ENGINE_VERSION,
    mode: ENGINE_MODE,
    hasData: !!(asOf || prices || macro || aiq),
  };
}

export function emptyStatus(): EngineStatus {
  return {
    asOf: null,
    prices: null,
    macro: null,
    aiq: null,
    engineVersion: ENGINE_VERSION,
    mode: ENGINE_MODE,
    hasData: false,
  };
}

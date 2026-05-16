/**
 * Server-only fetcher for the AIQ rubric editor at /aiq/[ticker].
 * Type-only consumers (client components, server actions) should import
 * `aiq-types` instead — this module pulls in the server Supabase client
 * and cannot be loaded from the client bundle.
 *
 * When env is unset (dev fixture mode), returns null + empty history so
 * the editor renders read-only.
 */
import { getSupabaseServer } from "./supabase/server";
import { FIXTURE_INDEX, type SeedRow } from "./universe-fixture";
import type { AiqRow } from "./aiq-types";

export interface AiqContext {
  seed: SeedRow | null;
  latest: AiqRow | null;
  history: AiqRow[];
  envConfigured: boolean;
}

const COLUMNS =
  "ticker,scored_at,disclosure_pts,defensibility_pts,concentration_pts,capex_eff_pts," +
  "indep_demand_pts,accounting_pts,total,notes," +
  "disclosure_note,defensibility_note,concentration_note,capex_eff_note,indep_demand_note,accounting_note," +
  "source_url";

export async function getAiqContext(ticker: string): Promise<AiqContext> {
  const t = ticker.toUpperCase();
  const seed = FIXTURE_INDEX[t] ?? null;
  const sb = await getSupabaseServer();
  if (!sb) return { seed, latest: null, history: [], envConfigured: false };

  const { data, error } = await sb
    .from("aiq_rubric")
    .select(COLUMNS)
    .eq("ticker", t)
    .order("scored_at", { ascending: false })
    .limit(20);
  if (error || !data) return { seed, latest: null, history: [], envConfigured: true };

  const rows = data as unknown as AiqRow[];
  return { seed, latest: rows[0] ?? null, history: rows, envConfigured: true };
}

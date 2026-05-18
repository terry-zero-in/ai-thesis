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
  "sources";

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

// ─── Index loader (/aiq) ────────────────────────────────────────────────────

export interface AiqIndexRow {
  ticker: string;
  name: string;
  layer: number;
  layer_label: string;
  total: number | null;
  scored_at: string | null;
  disclosure_pts: number | null;
  defensibility_pts: number | null;
  concentration_pts: number | null;
  capex_eff_pts: number | null;
  indep_demand_pts: number | null;
  accounting_pts: number | null;
}

export interface AiqIndexSnapshot {
  rows: AiqIndexRow[];
  asOf: string | null;
  synthetic: boolean;
  scoredCount: number;
}

export async function getAiqIndex(): Promise<AiqIndexSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) return synthesizeIndex();

  const { data: universe, error: ue } = await sb
    .from("universe")
    .select("ticker,name,layer,layer_label")
    .eq("is_active", true)
    .order("ticker");
  if (ue || !universe || universe.length === 0) return synthesizeIndex();

  const { data: rubric, error: re } = await sb
    .from("aiq_rubric")
    .select("ticker,scored_at,total,disclosure_pts,defensibility_pts,concentration_pts,capex_eff_pts,indep_demand_pts,accounting_pts")
    .order("scored_at", { ascending: false })
    .limit(universe.length * 4);
  if (re) return synthesizeIndex();

  const latestByTicker = new Map<string, AiqRow>();
  for (const r of (rubric ?? []) as AiqRow[]) {
    if (!latestByTicker.has(r.ticker)) latestByTicker.set(r.ticker, r);
  }

  let asOf: string | null = null;
  const rows: AiqIndexRow[] = (universe as Array<{ ticker: string; name: string; layer: number; layer_label: string }>).map((u) => {
    const r = latestByTicker.get(u.ticker);
    if (r?.scored_at && (!asOf || r.scored_at > asOf)) asOf = r.scored_at;
    return {
      ticker: u.ticker,
      name: u.name,
      layer: u.layer,
      layer_label: u.layer_label,
      total: r?.total ?? null,
      scored_at: r?.scored_at ?? null,
      disclosure_pts: r?.disclosure_pts ?? null,
      defensibility_pts: r?.defensibility_pts ?? null,
      concentration_pts: r?.concentration_pts ?? null,
      capex_eff_pts: r?.capex_eff_pts ?? null,
      indep_demand_pts: r?.indep_demand_pts ?? null,
      accounting_pts: r?.accounting_pts ?? null,
    };
  });

  return {
    rows,
    asOf,
    synthetic: false,
    scoredCount: rows.filter((r) => r.total != null).length,
  };
}

function synthesizeIndex(): AiqIndexSnapshot {
  const rows: AiqIndexRow[] = Object.values(FIXTURE_INDEX).map((s) => ({
    ticker: s.ticker,
    name: s.name,
    layer: s.layer,
    layer_label: s.layer_label,
    total: null,
    scored_at: null,
    disclosure_pts: null, defensibility_pts: null, concentration_pts: null,
    capex_eff_pts: null, indep_demand_pts: null, accounting_pts: null,
  }));
  return { rows, asOf: null, synthetic: true, scoredCount: 0 };
}

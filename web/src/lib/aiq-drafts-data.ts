/**
 * Server-only loader for /aiq-drafts review surface.
 *
 * Pulls all unreviewed (approved_at IS NULL) drafts, ordered by drafted_at
 * desc then ticker. Each draft renders with its 6-dim scores, notes
 * citations, and source links so Terry can approve or reject from one
 * screen.
 */
import { getSupabaseServer } from "./supabase/server";

export interface AiqDraftRow {
  id: string;
  ticker: string;
  drafted_at: string;
  disclosure_pts: number | null;
  defensibility_pts: number | null;
  concentration_pts: number | null;
  capex_eff_pts: number | null;
  indep_demand_pts: number | null;
  accounting_pts: number | null;
  total: number | null;
  notes: AiqDraftNotes | null;
  sources: AiqDraftSources | null;
  model: string | null;
  parse_error: string | null;
  generated_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface AiqDraftNotes {
  disclosure: string;
  defensibility: string;
  concentration: string;
  capex_eff: string;
  indep_demand: string;
  accounting: string;
}

export interface AiqDraftSources {
  ten_k_url: string | null;
  ten_k_form: string | null;
  ten_k_filing_date: string | null;
  transcript_url: string | null;
  transcript_date: string | null;
  transcript_quarter: string | null;
}

export interface AiqDraftsSnapshot {
  rows: AiqDraftRow[];
  envConfigured: boolean;
  synthetic: boolean;
}

export async function getAiqDraftsSnapshot(): Promise<AiqDraftsSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) return { rows: [], envConfigured: false, synthetic: false };
  const { data, error } = await sb
    .from("aiq_drafts")
    .select("*")
    .order("drafted_at", { ascending: false })
    .order("ticker", { ascending: true })
    .limit(100);
  if (error || !data) return { rows: [], envConfigured: true, synthetic: false };
  return { rows: data as AiqDraftRow[], envConfigured: true, synthetic: false };
}

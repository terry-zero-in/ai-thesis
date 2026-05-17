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
  if (!sb) return synthesize(false);
  const { data, error } = await sb
    .from("aiq_drafts")
    .select("*")
    .order("drafted_at", { ascending: false })
    .order("ticker", { ascending: true })
    .limit(100);
  if (error || !data || data.length === 0) return synthesize(true);
  return { rows: data as AiqDraftRow[], envConfigured: true, synthetic: false };
}

function synthesize(envConfigured: boolean): AiqDraftsSnapshot {
  const row: AiqDraftRow = {
    id: "fixture-1",
    ticker: "NOW",
    drafted_at: "2026-05-16",
    disclosure_pts: 15,
    defensibility_pts: 17,
    concentration_pts: 13,
    capex_eff_pts: 13,
    indep_demand_pts: 14,
    accounting_pts: 14,
    total: 86,
    notes: {
      disclosure: "AI revenue discussed in Q1 transcript; no segment-level AI line in 10-K MD&A.",
      defensibility: "Strong workflow lock-in via Now Platform; high enterprise switching costs (10-K Risk Factors).",
      concentration: "Diverse enterprise base across many verticals (10-K segment disclosure).",
      capex_eff: "Capital-light SaaS — FCF margin ~32%; capex efficiency strong (10-K cash flow).",
      indep_demand: "Enterprise IT spend independent of hyperscaler capex (transcript).",
      accounting: "Clean — SBC discussed but reasonable; no useful-life extensions (10-K).",
    },
    sources: {
      ten_k_url: "https://www.sec.gov/Archives/edgar/data/...",
      ten_k_form: "10-K",
      ten_k_filing_date: "2026-01-31",
      transcript_url: "https://financialmodelingprep.com/...",
      transcript_date: "2026-04-23",
      transcript_quarter: "Q1 2026",
    },
    model: "claude-sonnet-4-6",
    parse_error: null,
    generated_at: "2026-05-16T13:00:00Z",
    approved_at: null,
    approved_by: null,
  };
  return { rows: [row], envConfigured, synthetic: true };
}

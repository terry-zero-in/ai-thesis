"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { PromoteState } from "./action-types";

// State types + initial constant live in ./action-types because Next 16
// forbids non-async exports from "use server" modules (object exports throw
// at action-POST time with digest @E352).

interface DraftRow {
  id: string;
  ticker: string;
  drafted_at: string;
  disclosure_pts: number | null;
  defensibility_pts: number | null;
  concentration_pts: number | null;
  capex_eff_pts: number | null;
  indep_demand_pts: number | null;
  accounting_pts: number | null;
  notes: Record<string, string> | null;
  sources: { ten_k_url: string | null; transcript_url: string | null } | null;
  parse_error: string | null;
  approved_at: string | null;
}

/**
 * Promote a reviewed aiq_draft into the canonical aiq_rubric.
 *
 * Maps the draft's 6 dim scores + per-dim jsonb notes into the
 * aiq_rubric per-dim note columns. The draft's 10-K URL lands in
 * aiq_rubric.sources.disclosure (post-migration shape — the rubric
 * sources column is per-dim JSONB; 10-K maps semantically to the
 * Disclosure dim). Transcript URL is appended to the general notes
 * field as a secondary citation.
 *
 * Side effects (in one Supabase round per write):
 *   1. UPSERT aiq_rubric (ticker, scored_at=drafted_at) with the scores
 *   2. UPDATE aiq_drafts SET approved_at=now(), approved_by=<user email>
 *
 * RLS gate: only `authenticated` users can write to either table. The
 * proxy redirects unauthenticated callers to /login before this runs.
 */
export async function promoteAiqDraft(
  _prev: PromoteState,
  formData: FormData,
): Promise<PromoteState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing draft id." };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, message: "Supabase env not configured — promotion disabled in fixture mode." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: draft, error: readErr } = await sb
    .from("aiq_drafts")
    .select("id, ticker, drafted_at, disclosure_pts, defensibility_pts, concentration_pts, capex_eff_pts, indep_demand_pts, accounting_pts, notes, sources, parse_error, approved_at")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, message: `Load failed: ${readErr.message}` };
  if (!draft) return { ok: false, message: "Draft not found." };

  const d = draft as DraftRow;
  if (d.parse_error) return { ok: false, message: "Can't promote a draft with a parse_error." };
  if (d.approved_at) return { ok: false, message: `Already approved at ${d.approved_at.slice(0, 10)}.` };

  const dims: Array<keyof DraftRow> = [
    "disclosure_pts", "defensibility_pts", "concentration_pts",
    "capex_eff_pts", "indep_demand_pts", "accounting_pts",
  ];
  for (const k of dims) {
    if (d[k] == null) return { ok: false, message: `Draft missing ${String(k)}.` };
  }

  const transcriptCitation = d.sources?.transcript_url
    ? ` Transcript: ${d.sources.transcript_url}`
    : "";
  const generalNotes = `Promoted from aiq_draft ${d.id} on ${new Date().toISOString().slice(0, 10)}.${transcriptCitation}`;

  // aiq_drafts.sources is a single 10-K/transcript pair (legacy shape).
  // aiq_rubric.sources is per-dim JSONB (post-migration). 10-K filings map
  // most directly to the Disclosure dimension; operator can fan-out via the
  // editor afterward. Transcript URL stays in `notes` as a secondary citation.
  const rubricSources = d.sources?.ten_k_url ? { disclosure: d.sources.ten_k_url } : null;

  const rubricRow = {
    ticker: d.ticker,
    scored_at: d.drafted_at,
    disclosure_pts: d.disclosure_pts,
    defensibility_pts: d.defensibility_pts,
    concentration_pts: d.concentration_pts,
    capex_eff_pts: d.capex_eff_pts,
    indep_demand_pts: d.indep_demand_pts,
    accounting_pts: d.accounting_pts,
    notes: generalNotes,
    disclosure_note:    d.notes?.disclosure    ?? null,
    defensibility_note: d.notes?.defensibility ?? null,
    concentration_note: d.notes?.concentration ?? null,
    capex_eff_note:     d.notes?.capex_eff     ?? null,
    indep_demand_note:  d.notes?.indep_demand  ?? null,
    accounting_note:    d.notes?.accounting    ?? null,
    sources:            rubricSources,
  };

  const { error: upsertErr } = await sb
    .from("aiq_rubric")
    .upsert(rubricRow, { onConflict: "ticker,scored_at" });
  if (upsertErr) return { ok: false, message: `aiq_rubric upsert failed: ${upsertErr.message}` };

  const approver = user.email ?? user.id;
  const { error: updateErr } = await sb
    .from("aiq_drafts")
    .update({ approved_at: new Date().toISOString(), approved_by: approver })
    .eq("id", id);
  if (updateErr) return { ok: false, message: `aiq_drafts approval-stamp failed: ${updateErr.message}` };

  revalidatePath("/aiq-drafts");
  revalidatePath(`/aiq/${d.ticker}`);
  revalidatePath(`/universe/${d.ticker}`);
  return { ok: true, message: `Promoted ${d.ticker} (${d.drafted_at}) → aiq_rubric.` };
}

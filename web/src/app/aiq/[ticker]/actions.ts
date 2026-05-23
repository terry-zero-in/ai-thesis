"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DIMS, dimSlug, sourceFieldName, type AiqSources, type DimSlug } from "@/lib/aiq-types";

export interface SaveState {
  ok: boolean;
  message: string;
  /** Date string of the row that just saved — used to highlight it in history. */
  savedAt?: string;
}

const INITIAL: SaveState = { ok: false, message: "" };
export { INITIAL as SAVE_INITIAL };

/**
 * Versioned save for one AIQ rubric scoring. Every save inserts a NEW row
 * keyed on (ticker, scored_at=today). Same-day re-saves overwrite via
 * UPSERT so an editor session doesn't accumulate dozens of rows; cross-day
 * saves always create new audit-history entries.
 *
 * RLS gate: only `authenticated` users can write. The proxy will have
 * redirected unauthenticated callers to /login long before this runs.
 */
export async function saveAiqRubric(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) return { ok: false, message: "Missing ticker." };

  // Validate each dimension is in range.
  const dimValues: Record<string, number> = {};
  for (const d of DIMS) {
    const raw = formData.get(d.key);
    const n = raw == null ? NaN : Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > d.cap) {
      return { ok: false, message: `${d.label} must be an integer in 0…${d.cap}.` };
    }
    dimValues[d.key] = n;
  }

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, message: "Supabase env not configured — saves disabled until Supabase env is configured." };

  // Per-dim source URLs land in a JSONB column. Form fields are named
  // `source_<slug>` (e.g. source_disclosure) per sourceFieldName(). Only
  // populated dims show up in the JSONB; null when every dim is empty so
  // the column stays clean.
  const sources: AiqSources = {};
  for (const d of DIMS) {
    const slug = dimSlug(d.key) as DimSlug;
    const url = strOrNull(formData.get(sourceFieldName(slug)));
    if (url) sources[slug] = url;
  }
  const sourcesValue: AiqSources | null = Object.keys(sources).length > 0 ? sources : null;

  // THS-75: validate confidence — UI restricts to High/Medium/Low but the
  // column is plain text. Coerce empty → null; reject any other token so
  // we don't pollute the chip palette with operator typos.
  const confidenceRaw = strOrNull(formData.get("confidence"));
  const confidence =
    confidenceRaw == null
      ? null
      : ["High", "Medium", "Low"].includes(confidenceRaw)
        ? confidenceRaw
        : null;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const row = {
    ticker,
    scored_at: today,
    ...dimValues,
    notes: strOrNull(formData.get("notes")),
    disclosure_note:    strOrNull(formData.get("disclosure_note")),
    defensibility_note: strOrNull(formData.get("defensibility_note")),
    concentration_note: strOrNull(formData.get("concentration_note")),
    capex_eff_note:     strOrNull(formData.get("capex_eff_note")),
    indep_demand_note:  strOrNull(formData.get("indep_demand_note")),
    accounting_note:    strOrNull(formData.get("accounting_note")),
    sources:            sourcesValue,
    confidence,
    last_change_reason: strOrNull(formData.get("last_change_reason")),
  };

  // UPSERT on the (ticker, scored_at) PK: a same-day re-save overwrites
  // the in-progress row; the next-day save creates a NEW audit-history row.
  const { error } = await sb.from("aiq_rubric").upsert(row, { onConflict: "ticker,scored_at" });
  if (error) {
    return { ok: false, message: `Save failed: ${error.message}` };
  }

  revalidatePath(`/aiq/${ticker}`);
  revalidatePath(`/universe/${ticker}`);
  return { ok: true, message: `Saved as ${today}.`, savedAt: today };
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

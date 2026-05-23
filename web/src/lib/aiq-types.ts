/**
 * Pure type / constant module for AIQ rubric data. Safe to import from
 * client components — does not pull in the server-only Supabase client.
 *
 * `aiq-data.ts` is the matching server-only fetcher; client modules
 * import only from this file.
 */

export const DIMS = [
  { key: "disclosure_pts",    note: "disclosure_note",    label: "Disclosure",    cap: 20 },
  { key: "defensibility_pts", note: "defensibility_note", label: "Defensibility", cap: 20 },
  { key: "concentration_pts", note: "concentration_note", label: "Concentration", cap: 15 },
  { key: "capex_eff_pts",     note: "capex_eff_note",     label: "Capex Eff.",    cap: 15 },
  { key: "indep_demand_pts",  note: "indep_demand_note",  label: "Indep. Demand", cap: 15 },
  { key: "accounting_pts",    note: "accounting_note",    label: "Accounting",    cap: 15 },
] as const;

export type DimKey = (typeof DIMS)[number]["key"];
export type NoteKey = (typeof DIMS)[number]["note"];

/** Slug used inside the `sources` JSONB column (DimKey with `_pts` stripped). */
export type DimSlug = "disclosure" | "defensibility" | "concentration" | "capex_eff" | "indep_demand" | "accounting";

/** Per-dimension public-filings source URLs. All keys optional. */
export type AiqSources = Partial<Record<DimSlug, string>>;

/** Strip the `_pts` suffix from a DimKey to get its sources-JSONB slug. */
export function dimSlug(k: DimKey): DimSlug {
  return k.replace(/_pts$/, "") as DimSlug;
}

/** Per-dim form-field name for the per-dim source URL input (e.g. "source_disclosure"). */
export function sourceFieldName(slug: DimSlug): string {
  return `source_${slug}`;
}

/** Qualitative operator confidence in a scoring (THS-75 cockpit). */
export type AiqConfidence = "High" | "Medium" | "Low";
export const AIQ_CONFIDENCE_LEVELS: AiqConfidence[] = ["High", "Medium", "Low"];

/** Quarterly cadence: a ticker is "needs review" if its latest row is older
 * than this many days. Aligns with docs/Algorithm §Part 5 caveat 2:
 * "AIQ should be re-scored after every Q1 earnings cycle." 90 days is a
 * pragmatic proxy for "next earnings cycle" without per-ticker fiscal
 * calendars. */
export const AIQ_REVIEW_CADENCE_DAYS = 90;

/** Days since last scoring. Null when never scored. UTC midnight basis to
 * keep server/client renders deterministic. */
export function aiqDaysSinceScored(scoredAt: string | null): number | null {
  if (!scoredAt) return null;
  const last = new Date(scoredAt + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.floor((now - last) / 86_400_000);
}

/** Next-review date (YYYY-MM-DD) = scored_at + 90d. Null when never scored. */
export function aiqNextReviewDate(scoredAt: string | null): string | null {
  if (!scoredAt) return null;
  const next = new Date(scoredAt + "T00:00:00Z").getTime() + AIQ_REVIEW_CADENCE_DAYS * 86_400_000;
  return new Date(next).toISOString().slice(0, 10);
}

/** True when the latest scoring is older than the review cadence (or never scored). */
export function aiqNeedsReview(scoredAt: string | null): boolean {
  if (!scoredAt) return true;
  const days = aiqDaysSinceScored(scoredAt);
  return days != null && days > AIQ_REVIEW_CADENCE_DAYS;
}

export interface AiqRow {
  ticker: string;
  scored_at: string;
  disclosure_pts: number;
  defensibility_pts: number;
  concentration_pts: number;
  capex_eff_pts: number;
  indep_demand_pts: number;
  accounting_pts: number;
  total: number;
  notes: string | null;
  disclosure_note: string | null;
  defensibility_note: string | null;
  concentration_note: string | null;
  capex_eff_note: string | null;
  indep_demand_note: string | null;
  accounting_note: string | null;
  sources: AiqSources | null;
  /** THS-75: operator qualitative confidence. Free text in DB; UI restricts to High/Medium/Low. */
  confidence: AiqConfidence | string | null;
  /** THS-75: free-text rationale for the most-recent edit to this row. */
  last_change_reason: string | null;
}

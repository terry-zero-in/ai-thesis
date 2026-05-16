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
  source_url: string | null;
}

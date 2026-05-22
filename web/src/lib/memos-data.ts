/**
 * Server-only loader for the /memos route.
 *
 * Pulls the most recent daily + weekly memos from the `memos` table.
 * `failed=true` rows are kept and surfaced so the operator sees WHY a
 * memo is missing instead of an unexplained gap.
 */
import { getSupabaseServer } from "./supabase/server";

export type MemoKind = "daily" | "weekly";

export type MemoAction = "add" | "hold" | "trim" | "exit";

export interface WeeklyHighBookItem {
  ticker: string;
  final_score: number | null;
  bear_case: string;
  action: MemoAction;
  action_rationale: string;
}

export interface WeeklyMemoParsed {
  headline: string;
  summary: string;
  high_book: WeeklyHighBookItem[];
  cross_book_notes: string[];
  watch_next_week: string[];
}

export interface MemoSections {
  parsed: WeeklyMemoParsed | null;
  parse_error?: string | null;
}

export interface MemoRow {
  id: string;
  kind: MemoKind;
  as_of: string;
  headline: string | null;
  body: string | null;
  sections: MemoSections | null;
  model: string | null;
  generated_at: string;
  failed: boolean;
  error: string | null;
}

export interface MemosSnapshot {
  rows: MemoRow[];
  envConfigured: boolean;
  synthetic: boolean;
}

const LIMIT = 30;

export async function getMemosSnapshot(): Promise<MemosSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) return { rows: [], envConfigured: false, synthetic: false };

  const { data, error } = await sb
    .from("memos")
    .select("id,kind,as_of,headline,body,sections,model,generated_at,failed,error")
    .order("generated_at", { ascending: false })
    .limit(LIMIT);
  if (error || !data) return { rows: [], envConfigured: true, synthetic: false };

  return {
    rows: (data as MemoRow[]).slice(),
    envConfigured: true,
    synthetic: false,
  };
}


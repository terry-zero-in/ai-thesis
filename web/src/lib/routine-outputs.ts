/**
 * routine-outputs.ts — server-side getters for the 7 tables that the
 * Claude Code Routines (PR1, E80) write into.
 *
 * Architecture (S4 2026-05-18): app never calls Claude directly. All
 * Claude-touching work runs on claude.ai/code Routines (daily-batch,
 * weekly-rescore, monthly-curator, position-pulse). Each Routine has a
 * Supabase MCP connector pointed at ai-thesis project; it writes results
 * to the tables read by these helpers.
 *
 * All getters use getSupabaseServer() — never getSupabaseBrowser() from
 * server context (S3 lesson — silently falls to fixture on RLS deny).
 *
 * Shape-stable: when a Routine hasn't fired yet, getters return null /
 * empty arrays, not throw. UI surfaces an empty state.
 */

import { getSupabaseServer } from "./supabase/server";

// ─── Types matching the SQL schema in e80_routines_pr1.sql ─────────────

export interface InsiderSummary {
  as_of: string;
  summary: string;
  flagged_tickers: string[];
  buy_count: number;
  sell_count: number;
  created_at: string;
}

export interface MacroLog {
  as_of: string;
  regime_state: "neutral" | "tightened" | "cautious" | "defensive";
  gates_hit: number;
  multiplier: number;
  narrative: string;
  delta_summary: string | null;
  created_at: string;
}

export interface WeeklySummary {
  week_of: string;
  narrative: string;
  top_movers: Array<{ ticker: string; delta: number; reason: string }>;
  regime_state: string | null;
  multiplier: number | null;
  created_at: string;
}

export interface MemoProposal {
  id: string;
  ticker: string;
  drift_delta: number;
  suggested_memo: string;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface UniverseProposal {
  id: string;
  month_of: string;
  adds: Array<{ ticker: string; name: string; reason: string }>;
  trims: Array<{ ticker: string; reason: string }>;
  reasoning: string;
  status: "pending" | "partially_accepted" | "accepted" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface PositionPulse {
  user_id: string;
  ticker: string;
  as_of: string;
  verdict: "intact" | "weakening" | "broken";
  reasoning: string;
  score_delta: number | null;
  insider_signal: string | null;
  created_at: string;
}

export interface MorningBrief {
  insider: InsiderSummary | null;
  macro: MacroLog | null;
  pendingMemoProposals: MemoProposal[];
  asOf: string | null;
}

// ─── Getters ──────────────────────────────────────────────────────────

/**
 * Morning brief — surfaced on dashboard. Combines the most recent insider
 * digest, macro interpretation, and any pending memo proposals into one
 * server-side fetch.
 */
export async function getMorningBrief(): Promise<MorningBrief> {
  const sb = await getSupabaseServer();
  if (!sb) return { insider: null, macro: null, pendingMemoProposals: [], asOf: null };

  const [insiderRes, macroRes, memoRes] = await Promise.all([
    sb.from("insider_summary").select("*").order("as_of", { ascending: false }).limit(1).maybeSingle(),
    sb.from("macro_log").select("*").order("as_of", { ascending: false }).limit(1).maybeSingle(),
    sb.from("memo_proposals").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
  ]);

  const insider = (insiderRes.data as InsiderSummary | null) ?? null;
  const macro = (macroRes.data as MacroLog | null) ?? null;
  const pendingMemoProposals = (memoRes.data as MemoProposal[] | null) ?? [];
  const asOf = insider?.as_of ?? macro?.as_of ?? null;

  return { insider, macro, pendingMemoProposals, asOf };
}

/**
 * Most recent `macro_log` row in isolation — for surfaces (e.g., the
 * Dashboard "Today's Thesis" card, THS-74) that need macro state without
 * the full morning brief. Returns null when env is unset or the daily-batch
 * Routine hasn't fired yet.
 */
export async function getLatestMacroLog(): Promise<MacroLog | null> {
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data } = await sb
    .from("macro_log")
    .select("*")
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MacroLog | null) ?? null;
}

/**
 * Most recent weekly summary (Saturday rescore output).
 */
export async function getWeeklySummary(): Promise<WeeklySummary | null> {
  const sb = await getSupabaseServer();
  if (!sb) return null;
  const { data } = await sb
    .from("weekly_summary")
    .select("*")
    .order("week_of", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as WeeklySummary | null) ?? null;
}

/**
 * Universe proposal rows. Defaults to status='pending' for the /proposals
 * page. Pass status='all' to include resolved history.
 */
export async function getUniverseProposals(
  opts: { status?: "pending" | "all" } = {},
): Promise<UniverseProposal[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  let q = sb.from("universe_proposals").select("*").order("created_at", { ascending: false });
  if (opts.status !== "all") q = q.eq("status", "pending");
  const { data } = await q;
  return (data as UniverseProposal[] | null) ?? [];
}

/**
 * Memo proposals — pending by default. /aiq-drafts and dashboard both consume.
 */
export async function getMemoProposals(
  opts: { status?: "pending" | "all" } = {},
): Promise<MemoProposal[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  let q = sb.from("memo_proposals").select("*").order("created_at", { ascending: false });
  if (opts.status !== "all") q = q.eq("status", "pending");
  const { data } = await q;
  return (data as MemoProposal[] | null) ?? [];
}

/**
 * Position pulse — per-user. The cookie-bound server client resolves to
 * the caller's auth.uid() via RLS, so this returns only the calling
 * user's pulses without explicit userId filtering.
 */
export async function getPositionPulse(): Promise<PositionPulse[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data } = await sb
    .from("position_pulse")
    .select("*")
    .order("as_of", { ascending: false })
    .limit(20);
  return (data as PositionPulse[] | null) ?? [];
}

/**
 * Position pulses for tickers in a known list, latest as_of per ticker.
 * Used to decorate /portfolio rows with thesis-intact status. RLS scopes
 * to the caller automatically.
 */
export async function getLatestPulseByTicker(tickers: string[]): Promise<Record<string, PositionPulse>> {
  if (tickers.length === 0) return {};
  const sb = await getSupabaseServer();
  if (!sb) return {};
  const { data } = await sb
    .from("position_pulse")
    .select("*")
    .in("ticker", tickers)
    .order("as_of", { ascending: false });
  const map: Record<string, PositionPulse> = {};
  for (const row of (data as PositionPulse[] | null) ?? []) {
    if (!map[row.ticker]) map[row.ticker] = row;  // first = latest due to order
  }
  return map;
}

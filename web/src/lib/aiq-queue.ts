/**
 * aiq-queue.ts — helpers for the aiq_draft_queue work-list that the
 * daily-batch Routine processes.
 *
 * The app inserts to this queue in three cases:
 *   1. New ticker added to universe (e.g., monthly-curator ADD accepted)
 *   2. Drift threshold tripped (composite changed >10pts since last AIQ)
 *   3. Manual operator request (rare — UI exposes a "request fresh AIQ" CTA
 *      on /universe/[ticker] for cases where an automatic trigger missed)
 *
 * The queue has a UNIQUE (ticker, status) constraint preventing duplicate
 * 'queued' rows for the same ticker — enqueue is naturally idempotent.
 */

import { getSupabaseServer } from "./supabase/server";

export type EnqueueReason = "new_universe" | "drift" | "stale" | "manual";

export interface QueueRow {
  id: string;
  ticker: string;
  reason: EnqueueReason;
  status: "queued" | "processing" | "done" | "failed";
  requested_at: string;
  processed_at: string | null;
  failed_reason: string | null;
}

/**
 * Enqueue a ticker for the next daily-batch fire. Idempotent — duplicate
 * 'queued' rows are blocked by UNIQUE (ticker, status). Returns the row
 * (existing or newly inserted) or null if Supabase is unconfigured.
 */
export async function enqueueAiqDraft(
  ticker: string,
  reason: EnqueueReason,
): Promise<QueueRow | null> {
  const sb = await getSupabaseServer();
  if (!sb) return null;

  // UPSERT semantics: if a queued row already exists, do nothing; otherwise
  // insert. Either way return the queued row.
  const { data: upsertData, error: upsertErr } = await sb
    .from("aiq_draft_queue")
    .upsert(
      { ticker, reason, status: "queued" },
      { onConflict: "ticker,status", ignoreDuplicates: true },
    )
    .select("*")
    .maybeSingle();

  if (upsertErr) return null;
  if (upsertData) return upsertData as QueueRow;

  // Duplicate (was already queued) — return the existing row.
  const { data: existing } = await sb
    .from("aiq_draft_queue")
    .select("*")
    .eq("ticker", ticker)
    .eq("status", "queued")
    .maybeSingle();

  return (existing as QueueRow | null) ?? null;
}

/**
 * Current queue (status='queued'). Read-only — daily-batch flips status
 * to 'processing' / 'done' / 'failed' as it works through them.
 */
export async function getQueuedAiqDrafts(): Promise<QueueRow[]> {
  const sb = await getSupabaseServer();
  if (!sb) return [];
  const { data } = await sb
    .from("aiq_draft_queue")
    .select("*")
    .eq("status", "queued")
    .order("requested_at", { ascending: true });
  return (data as QueueRow[] | null) ?? [];
}

/**
 * Lookup which of these tickers are currently queued. Returns a Set for
 * O(1) membership checks on /universe rendering.
 */
export async function getQueuedTickerSet(): Promise<Set<string>> {
  const queued = await getQueuedAiqDrafts();
  return new Set(queued.map((q) => q.ticker));
}

/**
 * Tickers in any non-terminal state (queued OR processing) — for UI that
 * wants to show "pending" badge regardless of which stage the work is in.
 */
export async function getActiveTickerSet(): Promise<Set<string>> {
  const sb = await getSupabaseServer();
  if (!sb) return new Set();
  const { data } = await sb
    .from("aiq_draft_queue")
    .select("ticker")
    .in("status", ["queued", "processing"]);
  return new Set((data as { ticker: string }[] | null)?.map((r) => r.ticker) ?? []);
}

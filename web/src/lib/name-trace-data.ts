/**
 * Score-provenance trace data fetcher — Lambo Pass §G feature 1 wiring (S31).
 *
 * Builds a TraceData payload describing what changed in a ticker's composite
 * score between its two most recent `scores_history` rows. Powers the
 * <TraceOverlay> right panel which surfaces on the `T` keyboard shortcut from
 * any <TraceTarget>-wrapped score number.
 *
 * Schema note: the algorithm engine writes ALL per-factor scores onto a
 * single `scores_history` row per (ticker, as_of) — q_score, g_score,
 * v_score, aiq_score, composite, macro_multiplier all live together. There
 * are no separate q_scores / g_scores / v_scores / aiq_scores tables in
 * this schema (the cron jobs of those names write back into
 * scores_history). So the per-factor deltas are computed from the same two
 * rows, not from separate tables — one query, not five.
 *
 * Empty state: returns null when the engine hasn't computed twice on this
 * ticker (fewer than 2 history rows). The overlay's built-in "no trace
 * target" copy covers this; the page just doesn't surface the affordance.
 */
import { getSupabaseServer } from "./supabase/server";
import type { TraceAttribution, TraceData } from "@/components/conviction/TraceProvider";

interface ScoresHistoryRow {
  ticker: string;
  as_of: string;
  q_score: number | null;
  g_score: number | null;
  v_score: number | null;
  aiq_score: number | null;
  composite: number | null;
  macro_multiplier: number | null;
  computed_at: string | null;
}

const FACTOR_LABEL: Record<"q" | "g" | "v" | "aiq" | "macro", string> = {
  q: "Q quality",
  g: "G growth",
  v: "V valuation",
  aiq: "AIQ exposure",
  macro: "macro multiplier",
};

function delta(current: number | null, prior: number | null): number {
  if (current == null || prior == null) return 0;
  return Math.round((current - prior) * 10) / 10;
}

function windowDays(asOfCurrent: string, asOfPrior: string): number {
  const c = Date.parse(asOfCurrent);
  const p = Date.parse(asOfPrior);
  if (Number.isNaN(c) || Number.isNaN(p)) return 0;
  return Math.round((c - p) / 86_400_000);
}

/**
 * Fetch trace data for a single ticker's composite score. Pulls the two
 * most recent `scores_history` rows and derives per-factor deltas in JS.
 *
 * Returns null when:
 *   - Supabase env isn't configured (local dev with no creds)
 *   - The engine hasn't computed this ticker twice yet
 *   - Both history rows are missing a composite
 */
export async function getNameTraceData(ticker: string): Promise<TraceData | null> {
  const t = ticker.toUpperCase();
  const sb = await getSupabaseServer();
  if (!sb) return null;

  const { data, error } = await sb
    .from("scores_history")
    .select(
      "ticker,as_of,q_score,g_score,v_score,aiq_score,composite,macro_multiplier,computed_at",
    )
    .eq("ticker", t)
    .order("as_of", { ascending: false })
    .limit(2);

  if (error) return null;
  const rows = (data ?? []) as ScoresHistoryRow[];
  if (rows.length < 2) return null;

  const [current, prior] = rows;
  if (current.composite == null || prior.composite == null) return null;

  const deltaTotal = Math.round((current.composite - prior.composite) * 10) / 10;

  const attributions: TraceAttribution[] = [
    { factor: FACTOR_LABEL.q, delta: delta(current.q_score, prior.q_score) },
    { factor: FACTOR_LABEL.g, delta: delta(current.g_score, prior.g_score) },
    { factor: FACTOR_LABEL.v, delta: delta(current.v_score, prior.v_score) },
    { factor: FACTOR_LABEL.aiq, delta: delta(current.aiq_score, prior.aiq_score) },
    {
      factor: FACTOR_LABEL.macro,
      delta:
        current.macro_multiplier != null && prior.macro_multiplier != null
          ? Math.round((current.macro_multiplier - prior.macro_multiplier) * 100) / 100
          : 0,
    },
  ];

  const runIso = current.computed_at ?? current.as_of;
  const source = `scores_history · run ${runIso} · engine v1.0`;

  return {
    ticker: t,
    metric: "composite",
    current: current.composite,
    prior: prior.composite,
    asOfCurrent: current.as_of,
    asOfPrior: prior.as_of,
    deltaTotal,
    windowDays: windowDays(current.as_of, prior.as_of),
    attributions,
    source,
  };
}

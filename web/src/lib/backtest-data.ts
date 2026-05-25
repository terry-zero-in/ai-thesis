/**
 * Server-only loader for /backtest.
 *
 * Pulls the most recent backtest_runs rows. Fixture fallback so the
 * page renders in dev mode (and when the run-backtest function hasn't
 * been invoked yet).
 */
import { getSupabaseServer } from "./supabase/server";

export interface BacktestParams {
  top_n: number;
  cost_bps: number;
}

export interface BacktestSummary {
  total_return: number | null;
  sharpe: number | null;
  max_drawdown: number | null;
  hit_rate: number | null;
  avg_turnover: number | null;
  rebalance_count: number | null;
}

// Edge function `run-backtest` stores series as raw `number[]`; an older
// shape persisted `{as_of, ret}[]`. The renderer accepts either — see
// `zipMonthLabels()` in RunRow.tsx (THS-101 item 6).
export type BacktestPoint = number | { as_of: string; ret: number };
export type TurnoverPoint = number | { as_of: string; turnover: number };

export interface BacktestSeries {
  monthly_returns_net: BacktestPoint[];
  turnover: TurnoverPoint[];
}

export interface BacktestRun {
  id: string;
  ran_at: string;
  start_date: string;
  end_date: string;
  params: BacktestParams;
  summary: BacktestSummary;
  series: BacktestSeries | null;
  elapsed_ms: number | null;
  note: string | null;
}

export interface BacktestSnapshot {
  rows: BacktestRun[];
  envConfigured: boolean;
  synthetic: boolean;
}

const LIMIT = 25;

export async function getBacktestSnapshot(): Promise<BacktestSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) return { rows: [], envConfigured: false, synthetic: false };
  const { data, error } = await sb
    .from("backtest_runs")
    .select("id, ran_at, start_date, end_date, params, summary, series, elapsed_ms, note")
    .order("ran_at", { ascending: false })
    .limit(LIMIT);
  if (error || !data) return { rows: [], envConfigured: true, synthetic: false };
  return { rows: data as BacktestRun[], envConfigured: true, synthetic: false };
}

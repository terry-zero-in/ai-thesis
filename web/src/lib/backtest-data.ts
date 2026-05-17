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

export interface BacktestSeries {
  monthly_returns_net: Array<{ as_of: string; ret: number }>;
  turnover: Array<{ as_of: string; turnover: number }>;
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
  if (!sb) return synthesize(false);
  const { data, error } = await sb
    .from("backtest_runs")
    .select("id, ran_at, start_date, end_date, params, summary, series, elapsed_ms, note")
    .order("ran_at", { ascending: false })
    .limit(LIMIT);
  if (error || !data || data.length === 0) return synthesize(true);
  return { rows: data as BacktestRun[], envConfigured: true, synthetic: false };
}

function synthesize(envConfigured: boolean): BacktestSnapshot {
  const monthly: Array<{ as_of: string; ret: number }> = [];
  // 36 months ending 2026-04, deterministic seeded-ish returns for visual variety.
  const seed = [
    0.024, -0.011, 0.018, 0.032, -0.007, 0.041, 0.012, -0.022, 0.036, 0.005,
    -0.014, 0.029, 0.041, 0.008, -0.018, 0.027, 0.033, -0.009, 0.015, 0.044,
    -0.027, 0.011, 0.022, 0.031, 0.006, -0.015, 0.038, 0.019, -0.024, 0.042,
    0.013, 0.028, -0.011, 0.034, 0.017, 0.025,
  ];
  for (let i = 0; i < seed.length; i++) {
    const month = i % 12;
    const year = 2023 + Math.floor((i + 4) / 12);
    monthly.push({ as_of: `${year}-${String(month + 1).padStart(2, "0")}-01`, ret: seed[i] });
  }
  const turnover = monthly.map((m, i) => ({ as_of: m.as_of, turnover: 0.18 + (i % 5) * 0.04 }));

  return {
    rows: [
      {
        id: "fixture-run-1",
        ran_at: "2026-05-17T09:14:22Z",
        start_date: "2023-05-01",
        end_date: "2026-04-30",
        params: { top_n: 15, cost_bps: 10 },
        summary: {
          total_return: 0.842,
          sharpe: 1.43,
          max_drawdown: -0.187,
          hit_rate: 0.611,
          avg_turnover: 0.24,
          rebalance_count: 36,
        },
        series: { monthly_returns_net: monthly, turnover },
        elapsed_ms: 8420,
        note: "Walk-forward, monthly rebalance, current calibration.",
      },
      {
        id: "fixture-run-2",
        ran_at: "2026-04-12T22:01:09Z",
        start_date: "2023-05-01",
        end_date: "2026-04-30",
        params: { top_n: 20, cost_bps: 10 },
        summary: {
          total_return: 0.781,
          sharpe: 1.27,
          max_drawdown: -0.214,
          hit_rate: 0.594,
          avg_turnover: 0.31,
          rebalance_count: 36,
        },
        series: { monthly_returns_net: monthly.map((m) => ({ ...m, ret: m.ret * 0.92 })), turnover },
        elapsed_ms: 9180,
        note: "Wider book test (N=20).",
      },
    ],
    envConfigured,
    synthetic: true,
  };
}

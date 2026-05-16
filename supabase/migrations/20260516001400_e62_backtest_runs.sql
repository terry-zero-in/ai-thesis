-- THS-64 follow-on — Persist backtest runs.
--
-- `run-backtest` returns its report as the response body but doesn't
-- persist anything, which makes it impossible to compare parameter
-- sweeps or year-over-year calibration drift. This table captures one
-- row per invocation. The edge function writes after the JSON response
-- payload is assembled so the API contract is unchanged.

BEGIN;

CREATE TABLE IF NOT EXISTS public.backtest_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at      timestamptz NOT NULL DEFAULT now(),
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  params      jsonb NOT NULL,
  summary     jsonb NOT NULL,
  series      jsonb,
  elapsed_ms  int,
  note        text
);

COMMENT ON TABLE public.backtest_runs IS
  'Per-invocation persistence of `run-backtest` outputs. params holds {top_n, cost_bps, ...}; summary holds {total_return, sharpe, max_drawdown, hit_rate, avg_turnover, rebalance_count}; series holds {monthly_returns_net, turnover} for charting.';

CREATE INDEX IF NOT EXISTS backtest_runs_ran_at_desc_idx
  ON public.backtest_runs (ran_at DESC);

CREATE INDEX IF NOT EXISTS backtest_runs_window_idx
  ON public.backtest_runs (start_date, end_date);

ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY backtest_runs_authenticated_all ON public.backtest_runs
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.backtest_runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtest_runs TO authenticated;
GRANT ALL ON public.backtest_runs TO service_role;

COMMIT;

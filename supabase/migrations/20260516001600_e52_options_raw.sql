-- THS-59 (E5.2) — Options surface ingestion (Polygon).
--
-- Daily snapshot per ticker. The pure helpers in `_shared/options-metrics.ts`
-- compute three signals from the raw options chain:
--   - put_call_ratio: total put OI / total call OI (>1 = bearish)
--   - skew_25d:       IV(25Δ put) - IV(25Δ call), normalized.
--                     Positive = puts richer than calls = bearish.
--   - iv_term_slope:  mean IV of contracts >60d & ≤150d - mean IV of <=60d.
--                     Negative slope (backwardation) = near-term stress.
--
-- The S-score factor `options_skew` reads `skew_25d` directly. P/C and
-- IV term land here for future analytical use (and for the Linear ticket
-- acceptance: "Pull 25Δ put-call skew, P/C ratio, IV term structure
-- daily for all 70 names").
--
-- Schema is keyed (ticker, as_of). One row per ticker per trading day.
-- `raw` JSONB stashes the input shape for audit when a metric looks off.

BEGIN;

CREATE TABLE IF NOT EXISTS public.options_raw (
  ticker            text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  as_of             date NOT NULL,
  put_call_ratio    numeric,
  skew_25d          numeric,
  iv_term_slope     numeric,
  contracts_count   int,
  raw               jsonb,
  ingested_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, as_of)
);

COMMENT ON TABLE public.options_raw IS
  'Daily per-ticker options surface signals. put_call_ratio from OI ratio; skew_25d = IV(25Δ put) - IV(25Δ call); iv_term_slope = mean IV (60-150d) - mean IV (≤60d). Source: Polygon /v3/snapshot/options/{ticker}.';

CREATE INDEX IF NOT EXISTS options_raw_asof_desc_idx
  ON public.options_raw (as_of DESC);

CREATE INDEX IF NOT EXISTS options_raw_ticker_asof_desc_idx
  ON public.options_raw (ticker, as_of DESC);

ALTER TABLE public.options_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options_raw FORCE ROW LEVEL SECURITY;

CREATE POLICY options_raw_authenticated_all ON public.options_raw
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.options_raw TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.options_raw TO authenticated;
GRANT ALL ON public.options_raw TO service_role;

COMMIT;

-- THS-60 (E5.3) — Short interest + SUSI table.
--
-- FINRA publishes short interest twice monthly (around the 15th and the
-- end of the month). FMP exposes the snapshots at /short-interest/{symbol}.
--
-- SUSI (Spec §Fix 4): z-score of the latest short_interest against the
-- trailing 24-month baseline for the same ticker. Stored alongside the
-- raw observation so the S-composite reader can fetch one row per
-- ticker without recomputing.

BEGIN;

CREATE TABLE IF NOT EXISTS public.short_interest_raw (
  ticker             text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  settlement_date    date NOT NULL,
  short_interest     numeric,            -- shares short
  shares_outstanding numeric,            -- as reported with the SI snapshot
  avg_daily_volume   numeric,            -- 30-day ADV at the snapshot
  days_to_cover      numeric,            -- short_interest / avg_daily_volume
  susi_z             numeric,            -- (this SI - 24mo mean) / 24mo stdev
  ingested_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, settlement_date)
);

COMMENT ON TABLE public.short_interest_raw IS
  'FINRA short interest snapshots from FMP. susi_z is the time-series z-score against the trailing 24mo baseline, computed at ingest time.';

CREATE INDEX IF NOT EXISTS short_interest_ticker_date_desc_idx
  ON public.short_interest_raw (ticker, settlement_date DESC);

ALTER TABLE public.short_interest_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_interest_raw FORCE ROW LEVEL SECURITY;

CREATE POLICY short_interest_authenticated_all ON public.short_interest_raw
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.short_interest_raw TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_interest_raw TO authenticated;
GRANT ALL ON public.short_interest_raw TO service_role;

COMMIT;

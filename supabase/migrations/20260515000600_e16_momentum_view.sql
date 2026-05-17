-- THS-40 (E1.6) — Materialized view: 12-1 trailing return per ticker.
--
-- "12-1" = price from ~1 month ago divided by price from ~12 months ago,
-- minus 1. Skipping the most recent month is the standard cross-sectional
-- momentum convention (avoids short-term reversal).
--
-- Cutoff semantics: pick the most recent close at or before the calendar
-- cutoff. This handles weekends, holidays, and any ingestion gaps without
-- special-casing trading-day calendars.

BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.momentum_12_1 AS
WITH latest AS (
  SELECT ticker, MAX(date) AS as_of FROM public.prices_raw GROUP BY ticker
)
SELECT
  l.ticker,
  l.as_of,
  p_today.close                                            AS price_today,
  p_1m.close                                               AS price_1m_ago,
  p_12m.close                                              AS price_12m_ago,
  CASE
    WHEN p_1m.close IS NULL OR p_12m.close IS NULL OR p_12m.close = 0 THEN NULL
    ELSE (p_1m.close / p_12m.close) - 1
  END                                                      AS momentum_12_1,
  now()                                                    AS computed_at
FROM latest l
JOIN public.prices_raw p_today
  ON p_today.ticker = l.ticker AND p_today.date = l.as_of
LEFT JOIN LATERAL (
  SELECT close FROM public.prices_raw
  WHERE ticker = l.ticker AND date <= l.as_of - INTERVAL '30 days'
  ORDER BY date DESC LIMIT 1
) p_1m ON TRUE
LEFT JOIN LATERAL (
  SELECT close FROM public.prices_raw
  WHERE ticker = l.ticker AND date <= l.as_of - INTERVAL '365 days'
  ORDER BY date DESC LIMIT 1
) p_12m ON TRUE;

-- Unique index is required to enable REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS momentum_12_1_ticker_uidx
  ON public.momentum_12_1 (ticker);

COMMENT ON MATERIALIZED VIEW public.momentum_12_1 IS
  'Latest 12-1 trailing return per ticker. Refreshed after the daily price ingest. Use REFRESH MATERIALIZED VIEW CONCURRENTLY public.momentum_12_1.';

-- Grant + RLS treatment: matviews don't support row-level security directly.
-- We block anon from selecting and let authenticated + service_role read.
REVOKE ALL ON public.momentum_12_1 FROM PUBLIC;
GRANT SELECT ON public.momentum_12_1 TO authenticated, service_role;

COMMIT;

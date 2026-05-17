-- THS-43 (E2.3) — forward_pe_history: per-ticker daily forward P/E.
--
-- The V-score's "own-history fwd P/E z-score" sub-signal needs a trailing
-- forward-P/E series per ticker. We compute it from existing data
-- (prices_raw × consensus, joined on (ticker, date=as_of)) rather than
-- ingesting a separate vendor history — Terry's decision in this session:
--
--   "derivation matches the live computation method, no vendor history
--    risk, no methodology break between historical baseline and current
--    value. History accumulates from the moment ingestion starts."
--
-- forward_pe = close / ntm_eps, with NULL/zero ntm_eps filtered out.
-- Refreshed nightly via refresh_forward_pe_history() RPC (same SECURITY
-- DEFINER + service-role pattern as refresh_momentum_12_1()).
--
-- Graceful-degradation policy (enforced in factor-v.ts, not here):
--   < 90 obs  → own-history z-score sub-signal is NULL, V rescales the
--               other two signals to 1.0
--   90–365   → compute z, flag low-confidence in factor_breakdown JSONB
--   365+     → full confidence; use min(5y, available history)
--
-- Use a regular materialized view (not an indexed view) so we can refresh
-- in bulk without locking the underlying tables.

BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.forward_pe_history AS
SELECT
  p.ticker,
  p.date,
  p.close,
  c.ntm_eps,
  (p.close / c.ntm_eps)::numeric AS forward_pe,
  now()                          AS computed_at
FROM public.prices_raw p
JOIN public.consensus c
  ON c.ticker = p.ticker
 AND c.as_of  = p.date
WHERE p.close IS NOT NULL
  AND c.ntm_eps IS NOT NULL
  AND c.ntm_eps > 0;

CREATE UNIQUE INDEX IF NOT EXISTS forward_pe_history_ticker_date_uidx
  ON public.forward_pe_history (ticker, date);

CREATE INDEX IF NOT EXISTS forward_pe_history_ticker_date_desc_idx
  ON public.forward_pe_history (ticker, date DESC);

COMMENT ON MATERIALIZED VIEW public.forward_pe_history IS
  'Daily forward P/E per ticker, derived from prices_raw × consensus. Use REFRESH MATERIALIZED VIEW CONCURRENTLY public.forward_pe_history.';

REVOKE ALL ON public.forward_pe_history FROM PUBLIC;
GRANT SELECT ON public.forward_pe_history TO authenticated, service_role;

COMMIT;

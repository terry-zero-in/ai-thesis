-- THS-43 (E2.3) — RPC to refresh forward_pe_history. Mirrors the
-- refresh_momentum_12_1 pattern. Called nightly after the price + consensus
-- ingestion settles.

BEGIN;

CREATE OR REPLACE FUNCTION public.refresh_forward_pe_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.forward_pe_history;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_forward_pe_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_forward_pe_history() TO service_role;

COMMENT ON FUNCTION public.refresh_forward_pe_history IS
  'Refreshes forward_pe_history matview concurrently. Service-role only.';

COMMIT;

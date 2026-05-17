-- THS-40 (E1.6) — RPC for the ingest-prices function to refresh the matview
-- without needing direct REFRESH MATERIALIZED VIEW privileges in the
-- service-role pathway (which PostgREST routes through SECURITY INVOKER fns
-- by default; SECURITY DEFINER plus a tight owner is cleaner).

BEGIN;

CREATE OR REPLACE FUNCTION public.refresh_momentum_12_1()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.momentum_12_1;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_momentum_12_1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_momentum_12_1() TO service_role;

COMMENT ON FUNCTION public.refresh_momentum_12_1 IS
  'Refreshes the 12-1 momentum matview concurrently. Callable by service_role only.';

COMMIT;

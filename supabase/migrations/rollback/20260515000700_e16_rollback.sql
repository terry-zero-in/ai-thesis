-- Rollback for 20260515000700_e16_refresh_rpc.sql.

BEGIN;
DROP FUNCTION IF EXISTS public.refresh_momentum_12_1();
COMMIT;

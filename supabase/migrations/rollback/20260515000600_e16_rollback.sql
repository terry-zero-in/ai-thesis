-- Rollback for 20260515000600_e16_momentum_view.sql (THS-40 part 2).

BEGIN;
DROP MATERIALIZED VIEW IF EXISTS public.momentum_12_1;
COMMIT;

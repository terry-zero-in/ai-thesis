-- Rollback for 20260515001400_e22_extend_fundamentals_rd.sql.
BEGIN;
ALTER TABLE public.fundamentals_raw DROP COLUMN IF EXISTS r_and_d_expense;
COMMIT;

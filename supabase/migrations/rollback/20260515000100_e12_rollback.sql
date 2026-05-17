-- Rollback for 20260515000100_e12_overlay_tables.sql (THS-36).

BEGIN;

DROP TABLE IF EXISTS public.scores_history     CASCADE;
DROP TABLE IF EXISTS public.depreciation_flags CASCADE;
DROP TABLE IF EXISTS public.aiq_rubric         CASCADE;

COMMIT;

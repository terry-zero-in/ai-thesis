-- Rollback for 20260516000100_e44_aiq_rubric_extend.sql (THS-54).

BEGIN;

ALTER TABLE public.aiq_rubric
  DROP COLUMN IF EXISTS disclosure_note,
  DROP COLUMN IF EXISTS defensibility_note,
  DROP COLUMN IF EXISTS concentration_note,
  DROP COLUMN IF EXISTS capex_eff_note,
  DROP COLUMN IF EXISTS indep_demand_note,
  DROP COLUMN IF EXISTS accounting_note,
  DROP COLUMN IF EXISTS source_url;

COMMIT;

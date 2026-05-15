BEGIN;
ALTER TABLE public.fundamentals_raw DROP COLUMN IF EXISTS depreciation_and_amortization;
COMMIT;

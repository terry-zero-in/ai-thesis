-- THS-43 prep — extend fundamentals_raw with depreciation & amortization.
-- Needed by V-score PEG-like signal: EBITDA = operating_income + D&A, then
-- EV/EBITDA / ntm_revenue_growth. FMP /stable/income-statement exposes
-- `depreciationAndAmortization` at no incremental cost.

BEGIN;

ALTER TABLE public.fundamentals_raw
  ADD COLUMN IF NOT EXISTS depreciation_and_amortization numeric;

COMMENT ON COLUMN public.fundamentals_raw.depreciation_and_amortization IS
  'Depreciation + amortization expense for the period (FMP depreciationAndAmortization). Positive magnitude. EBITDA = operating_income + D&A for the V-score PEG-like signal.';

COMMIT;

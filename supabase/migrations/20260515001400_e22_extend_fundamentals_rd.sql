-- THS-42 prep — extend fundamentals_raw with R&D expense.
-- The L5 capex-efficiency formula (algorithm spec §Fix 4) reads
-- "AI-attributed ARR / (disclosed AI R&D + infra spend)". R&D isn't
-- separately ingested today; fall back without it would conflate R&D
-- with S&M + G&A. FMP /stable/income-statement exposes
-- `researchAndDevelopmentExpenses` at no incremental cost.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.

BEGIN;

ALTER TABLE public.fundamentals_raw
  ADD COLUMN IF NOT EXISTS r_and_d_expense numeric;

COMMENT ON COLUMN public.fundamentals_raw.r_and_d_expense IS
  'Research & development operating expense for the period (FMP researchAndDevelopmentExpenses). Stored as positive magnitude; consumed by G-score L5 capex-efficiency denominator (R&D + capex).';

COMMIT;

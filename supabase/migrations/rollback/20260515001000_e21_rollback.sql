-- Rollback for 20260515001000_e21_extend_fundamentals_for_qmj.sql.
-- Drops the eight QMJ-support columns from fundamentals_raw. Idempotent.

BEGIN;

ALTER TABLE public.fundamentals_raw
  DROP COLUMN IF EXISTS cash_and_equivalents,
  DROP COLUMN IF EXISTS retained_earnings,
  DROP COLUMN IF EXISTS current_assets,
  DROP COLUMN IF EXISTS current_liabilities,
  DROP COLUMN IF EXISTS income_before_tax,
  DROP COLUMN IF EXISTS income_tax_expense,
  DROP COLUMN IF EXISTS dividends_paid,
  DROP COLUMN IF EXISTS common_stock_repurchased;

COMMIT;

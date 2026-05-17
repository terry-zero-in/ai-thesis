-- THS-41 prerequisite — extend fundamentals_raw with the columns the Q-score
-- (AQR QMJ adapted) needs that the slim THS-35 schema didn't carry.
--
-- Added columns:
--   cash_and_equivalents       — invested capital denominator (ROIC), Altman Z
--   retained_earnings          — Altman Z (ratio to total assets)
--   current_assets             — Altman Z working capital component
--   current_liabilities        — Altman Z working capital component
--   income_before_tax          — effective tax rate for NOPAT in ROIC
--   income_tax_expense         — effective tax rate for NOPAT in ROIC
--   dividends_paid             — payout pillar (cash outflow, positive)
--   common_stock_repurchased   — payout pillar (cash outflow, positive)
--
-- Sign convention: dividends_paid and common_stock_repurchased are stored as
-- POSITIVE magnitudes (FMP returns them negative since they are cash outflows).
-- This matches the spec's payout formula: (buybacks + dividends) / market cap.
-- ingest-fundamentals applies the sign flip before upserting.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.

BEGIN;

ALTER TABLE public.fundamentals_raw
  ADD COLUMN IF NOT EXISTS cash_and_equivalents     numeric,
  ADD COLUMN IF NOT EXISTS retained_earnings        numeric,
  ADD COLUMN IF NOT EXISTS current_assets           numeric,
  ADD COLUMN IF NOT EXISTS current_liabilities      numeric,
  ADD COLUMN IF NOT EXISTS income_before_tax        numeric,
  ADD COLUMN IF NOT EXISTS income_tax_expense       numeric,
  ADD COLUMN IF NOT EXISTS dividends_paid           numeric,
  ADD COLUMN IF NOT EXISTS common_stock_repurchased numeric;

COMMENT ON COLUMN public.fundamentals_raw.cash_and_equivalents IS
  'Balance-sheet cash + short-term equivalents (FMP cashAndCashEquivalents).';
COMMENT ON COLUMN public.fundamentals_raw.retained_earnings IS
  'Retained earnings (FMP retainedEarnings). Altman Z numerator component.';
COMMENT ON COLUMN public.fundamentals_raw.current_assets IS
  'Total current assets (FMP totalCurrentAssets). Working capital component.';
COMMENT ON COLUMN public.fundamentals_raw.current_liabilities IS
  'Total current liabilities (FMP totalCurrentLiabilities). Working capital component.';
COMMENT ON COLUMN public.fundamentals_raw.income_before_tax IS
  'Pre-tax income (FMP incomeBeforeTax). Used with income_tax_expense to derive effective tax rate.';
COMMENT ON COLUMN public.fundamentals_raw.income_tax_expense IS
  'Tax expense for the period (FMP incomeTaxExpense). Effective rate = income_tax_expense / income_before_tax.';
COMMENT ON COLUMN public.fundamentals_raw.dividends_paid IS
  'Dividends paid, stored as POSITIVE magnitude (cash outflow). FMP dividendsPaid arrives negative; ingest-fundamentals takes abs().';
COMMENT ON COLUMN public.fundamentals_raw.common_stock_repurchased IS
  'Buybacks, stored as POSITIVE magnitude (cash outflow). FMP commonStockRepurchased arrives negative; ingest-fundamentals takes abs().';

COMMIT;

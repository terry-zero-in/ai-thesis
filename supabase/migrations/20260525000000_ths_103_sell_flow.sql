-- THS-103 — Sell flow + realized P&L
--
-- Adds realized-P&L tracking to portfolio_positions for the sell flow.
-- Single-row-per-ticker model preserved (no transactions ledger in v1).
-- On sell:
--   - decrement shares by shares_sold
--   - exit_price = most recent sell price (display/audit only)
--   - realized_pl, realized_proceeds accumulate across multiple sells
--   - original_shares captures pre-first-sell share count
--   - closed_at set ONLY when shares reaches 0 (full close)
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + DROP/ADD CONSTRAINT pattern.

BEGIN;

ALTER TABLE public.portfolio_positions
  ADD COLUMN IF NOT EXISTS exit_price        numeric NULL,
  ADD COLUMN IF NOT EXISTS realized_pl       numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS realized_proceeds numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_shares   numeric NULL;

-- Relax shares > 0 → shares >= 0 so fully-closed positions (shares=0,
-- closed_at=date) remain valid rows. Open positions still require shares > 0
-- enforced at the app layer (sellPosition validates atomically).
ALTER TABLE public.portfolio_positions
  DROP CONSTRAINT IF EXISTS portfolio_positions_shares_check;
ALTER TABLE public.portfolio_positions
  ADD CONSTRAINT portfolio_positions_shares_check
  CHECK (shares >= 0);

ALTER TABLE public.portfolio_positions
  DROP CONSTRAINT IF EXISTS portfolio_positions_exit_price_positive;
ALTER TABLE public.portfolio_positions
  ADD CONSTRAINT portfolio_positions_exit_price_positive
  CHECK (exit_price IS NULL OR exit_price > 0);

ALTER TABLE public.portfolio_positions
  DROP CONSTRAINT IF EXISTS portfolio_positions_original_shares_positive;
ALTER TABLE public.portfolio_positions
  ADD CONSTRAINT portfolio_positions_original_shares_positive
  CHECK (original_shares IS NULL OR original_shares > 0);

COMMENT ON COLUMN public.portfolio_positions.exit_price IS
  'Per-share price of the MOST RECENT sale. NULL until first sale. Display/audit only — realized_pl is the canonical math.';
COMMENT ON COLUMN public.portfolio_positions.realized_pl IS
  'Cumulative realized P&L across all sales: sum of (exit_price - cost_basis) * shares_sold.';
COMMENT ON COLUMN public.portfolio_positions.realized_proceeds IS
  'Cumulative gross proceeds from sales: sum of exit_price * shares_sold. Used for reserves reconciliation.';
COMMENT ON COLUMN public.portfolio_positions.original_shares IS
  'Share count at moment of first sale. NULL for never-sold positions. Used to display "5 of 10 sold".';

COMMIT;

-- Rollback for THS-55 portfolio positions tracker.

BEGIN;

DROP TRIGGER IF EXISTS portfolio_positions_set_updated_at ON public.portfolio_positions;
DROP TRIGGER IF EXISTS portfolio_settings_set_updated_at ON public.portfolio_settings;

DROP TABLE IF EXISTS public.portfolio_positions;
DROP TABLE IF EXISTS public.portfolio_settings;

-- tg_set_updated_at() may be reused by future tables; only drop if no
-- other table still uses it. Safe-drop with cascade off so it errors loud
-- if something does depend on it.
DROP FUNCTION IF EXISTS public.tg_set_updated_at();

COMMIT;

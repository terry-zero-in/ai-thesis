-- Rollback for 20260515001300_e22_seed_ai_segment_overrides.sql.
-- Removes only the two rows the seed inserted. Operator-added rows are
-- preserved.

BEGIN;

DELETE FROM public.ai_segment_overrides
  WHERE (ticker, period_end) IN (
    ('NVDA', DATE '2026-04-27'),
    ('AVGO', DATE '2026-02-02')
  );

COMMIT;

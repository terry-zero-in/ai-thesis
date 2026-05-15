-- Rollback for 20260515001200_e22_ai_segment_overrides.sql.
-- Drops the table, trigger, and trigger function. Idempotent.

BEGIN;

DROP TABLE IF EXISTS public.ai_segment_overrides CASCADE;
DROP FUNCTION IF EXISTS public.tg_ai_segment_overrides_set_updated_at();

COMMIT;

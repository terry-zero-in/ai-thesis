BEGIN;
DROP FUNCTION IF EXISTS public.upsert_composite_score(text, date, numeric, numeric, text, int, numeric, jsonb, jsonb);
COMMIT;

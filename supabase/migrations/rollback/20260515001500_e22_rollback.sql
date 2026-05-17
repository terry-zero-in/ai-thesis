BEGIN;
DROP FUNCTION IF EXISTS public.upsert_factor_score(text, date, text, numeric, jsonb);
COMMIT;

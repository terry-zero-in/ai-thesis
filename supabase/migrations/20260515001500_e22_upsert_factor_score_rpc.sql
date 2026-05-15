-- THS-42 — RPC that lets each per-factor compute job (Q, G, V, AIQ, etc.)
-- write its own slice of `scores_history` without trampling siblings.
--
-- Problem this solves:
--   `scores_history` has one row per (ticker, as_of) with q_score / g_score /
--   v_score / aiq_score columns and a shared `factor_breakdown` JSONB. If
--   each per-factor job does a plain `upsert`, the second job's write
--   replaces `factor_breakdown` wholesale and wipes the first job's nested
--   keys. The Supabase JS client's `.upsert()` is INSERT ... ON CONFLICT DO
--   UPDATE with all columns replaced.
--
-- This RPC:
--   - validates the factor name against the known score columns
--   - upserts the (ticker, as_of) row
--   - sets the named score column (q_score / g_score / …)
--   - shallow-merges the factor's JSON into `factor_breakdown` so peers
--     stay intact. Per-factor jobs always overwrite their own top-level
--     key (e.g. compute-q-scores re-writes factor_breakdown -> 'q').
--
-- Security:
--   SECURITY DEFINER so it runs with the table owner's rights even when
--   called from a service-role JWT against RLS-forced tables. Grant
--   EXECUTE only to service_role; anon and authenticated can't reach it.

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_factor_score(
  p_ticker     text,
  p_as_of      date,
  p_factor     text,
  p_score      numeric,
  p_breakdown  jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score_col text;
BEGIN
  -- Whitelist the factor name. Format-injection guard before we EXECUTE.
  IF p_factor NOT IN ('q', 'g', 'v', 'aiq', 'm', 's') THEN
    RAISE EXCEPTION 'upsert_factor_score: unknown factor %', p_factor;
  END IF;
  v_score_col := p_factor || '_score';

  -- Insert if missing, otherwise update the named score column and merge
  -- the breakdown slice under p_factor's top-level key. COALESCE handles
  -- a NULL factor_breakdown column (newly-inserted rows).
  EXECUTE format(
    'INSERT INTO public.scores_history (ticker, as_of, %1$I, factor_breakdown) '
    'VALUES ($1, $2, $3, jsonb_build_object($4, $5)) '
    'ON CONFLICT (ticker, as_of) DO UPDATE SET '
    '  %1$I = EXCLUDED.%1$I, '
    '  factor_breakdown = COALESCE(public.scores_history.factor_breakdown, ''{}''::jsonb) || jsonb_build_object($4, $5)',
    v_score_col
  )
  USING p_ticker, p_as_of, p_score, p_factor, p_breakdown;
END;
$$;

COMMENT ON FUNCTION public.upsert_factor_score(text, date, text, numeric, jsonb) IS
  'Per-factor writer for scores_history that merges JSONB factor_breakdown instead of replacing it. Service-role only; whitelist of factor names.';

REVOKE ALL ON FUNCTION public.upsert_factor_score(text, date, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_factor_score(text, date, text, numeric, jsonb) TO service_role;

COMMIT;

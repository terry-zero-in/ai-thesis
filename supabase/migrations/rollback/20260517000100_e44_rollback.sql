-- Rollback for 20260517000100_e44_aiq_rubric_sources_jsonb.sql
-- Restores the single source_url column and copies sources.disclosure back
-- into it. Any other per-dim source URLs (defensibility/concentration/...)
-- are lost in the rollback — that data only exists in the post-migration
-- shape.

BEGIN;

ALTER TABLE public.aiq_rubric
  ADD COLUMN IF NOT EXISTS source_url text;

COMMENT ON COLUMN public.aiq_rubric.source_url IS
  'Primary public-filings source URL (10-K/Q, IR deck, etc.). Optional.';

UPDATE public.aiq_rubric
   SET source_url = sources ->> 'disclosure'
 WHERE sources ? 'disclosure'
   AND source_url IS NULL;

ALTER TABLE public.aiq_rubric
  DROP COLUMN IF EXISTS sources;

COMMIT;

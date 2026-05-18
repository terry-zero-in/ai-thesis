-- THS-54 (E4.4 followup) — Replace aiq_rubric.source_url (single column) with
-- sources JSONB keyed by dim. Spec §5.6 line 689+696 shows per-dimension
-- "Source URL: [...]" lines beneath each dim's rationale block.
-- Ref: docs/AI-Thesis-v2-Master-Design-Spec.md §5.6
--
-- Shape:
--   sources jsonb — { disclosure?: text, defensibility?: text, concentration?: text,
--                     capex_eff?: text, indep_demand?: text, accounting?: text }
--   All keys optional, omit when null. Single column keeps the schema clean
--   and avoids 6 parallel ALTERs.
--
-- Backfill: existing source_url values land in sources.disclosure (10-K /
-- IR-release is most directly a disclosure-dimension citation, matching how
-- aiq-drafts/actions.ts has historically populated source_url from ten_k_url).
-- After backfill, source_url column is dropped.

BEGIN;

ALTER TABLE public.aiq_rubric
  ADD COLUMN IF NOT EXISTS sources jsonb;

COMMENT ON COLUMN public.aiq_rubric.sources IS
  'Per-dimension source URLs. Keys: disclosure, defensibility, concentration, capex_eff, indep_demand, accounting. All optional.';

-- Backfill: lift any non-null source_url into sources.disclosure, preserve
-- pre-existing sources content if a row somehow already has it set.
UPDATE public.aiq_rubric
   SET sources = COALESCE(sources, '{}'::jsonb) || jsonb_build_object('disclosure', source_url)
 WHERE source_url IS NOT NULL
   AND (sources IS NULL OR NOT (sources ? 'disclosure'));

ALTER TABLE public.aiq_rubric
  DROP COLUMN IF EXISTS source_url;

COMMIT;

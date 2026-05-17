-- THS-54 (E4.4) — Extend aiq_rubric with per-dimension notes + source URL
-- Ref: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §AIQ rubric
--
-- The editor (/aiq/[ticker]) per ticket spec needs:
--   - Inline numeric edit for the 6 dimensions (already supported)
--   - Notes textarea PER dimension (new — was a single `notes` column)
--   - Source URL field (new)
--
-- Existing `notes` column stays as a general rationale field so prior
-- seed rows from THS-46 remain readable. Per-dim notes default null
-- and only get populated by the editor going forward.
--
-- All columns nullable so the THS-46 seed (no per-dim notes, no source_url)
-- doesn't need backfill.

BEGIN;

ALTER TABLE public.aiq_rubric
  ADD COLUMN IF NOT EXISTS disclosure_note     text,
  ADD COLUMN IF NOT EXISTS defensibility_note  text,
  ADD COLUMN IF NOT EXISTS concentration_note  text,
  ADD COLUMN IF NOT EXISTS capex_eff_note      text,
  ADD COLUMN IF NOT EXISTS indep_demand_note   text,
  ADD COLUMN IF NOT EXISTS accounting_note     text,
  ADD COLUMN IF NOT EXISTS source_url          text;

COMMENT ON COLUMN public.aiq_rubric.disclosure_note    IS 'Per-dim rationale, free text. Optional.';
COMMENT ON COLUMN public.aiq_rubric.defensibility_note IS 'Per-dim rationale, free text. Optional.';
COMMENT ON COLUMN public.aiq_rubric.concentration_note IS 'Per-dim rationale, free text. Optional.';
COMMENT ON COLUMN public.aiq_rubric.capex_eff_note     IS 'Per-dim rationale, free text. Optional.';
COMMENT ON COLUMN public.aiq_rubric.indep_demand_note  IS 'Per-dim rationale, free text. Optional.';
COMMENT ON COLUMN public.aiq_rubric.accounting_note    IS 'Per-dim rationale, free text. Optional.';
COMMENT ON COLUMN public.aiq_rubric.source_url         IS 'Primary public-filings source URL (10-K/Q, IR deck, etc.). Optional.';

COMMIT;

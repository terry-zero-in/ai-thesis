-- THS-47 (E3.2) — AIQ rubric draft staging.
--
-- The `generate-aiq-draft` edge function pulls each ticker's most recent
-- 10-K (SEC EDGAR) + earnings call transcript (FMP) and hands them to
-- Claude with the 6-dim rubric prompt. Drafts land here, NOT in
-- `aiq_rubric`. Terry reviews via /aiq-drafts; approved rows are then
-- inserted (manually or via a one-line action) into the canonical
-- `aiq_rubric` table.
--
-- Source excerpts persist in `sources` JSONB so the audit trail survives
-- — the 6 dimensions need a citation per spec acceptance.

BEGIN;

CREATE TABLE IF NOT EXISTS public.aiq_drafts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker              text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  drafted_at          date NOT NULL,
  disclosure_pts      int CHECK (disclosure_pts BETWEEN 0 AND 20),
  defensibility_pts   int CHECK (defensibility_pts BETWEEN 0 AND 20),
  concentration_pts   int CHECK (concentration_pts BETWEEN 0 AND 15),
  capex_eff_pts       int CHECK (capex_eff_pts BETWEEN 0 AND 15),
  indep_demand_pts    int CHECK (indep_demand_pts BETWEEN 0 AND 15),
  accounting_pts      int CHECK (accounting_pts BETWEEN 0 AND 15),
  total               int GENERATED ALWAYS AS (
    COALESCE(disclosure_pts, 0) + COALESCE(defensibility_pts, 0) + COALESCE(concentration_pts, 0) +
    COALESCE(capex_eff_pts, 0) + COALESCE(indep_demand_pts, 0) + COALESCE(accounting_pts, 0)
  ) STORED,
  notes               jsonb,                -- {disclosure: "...", defensibility: "...", ...}
  sources             jsonb,                -- {transcript_url, ten_k_url, transcript_excerpt, ten_k_excerpt}
  model               text,
  parse_error         text,                 -- when Claude's output failed strict JSON parse
  generated_at        timestamptz NOT NULL DEFAULT now(),
  approved_at         timestamptz,
  approved_by         text,
  UNIQUE (ticker, drafted_at)
);

COMMENT ON TABLE public.aiq_drafts IS
  'Claude-generated AIQ rubric drafts pending Terry review. Promoted manually to aiq_rubric on approval. sources JSONB preserves the citation per dimension.';

CREATE INDEX IF NOT EXISTS aiq_drafts_ticker_drafted_desc_idx
  ON public.aiq_drafts (ticker, drafted_at DESC);

CREATE INDEX IF NOT EXISTS aiq_drafts_unreviewed_idx
  ON public.aiq_drafts (drafted_at DESC) WHERE approved_at IS NULL;

ALTER TABLE public.aiq_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiq_drafts FORCE ROW LEVEL SECURITY;

CREATE POLICY aiq_drafts_authenticated_all ON public.aiq_drafts
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.aiq_drafts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aiq_drafts TO authenticated;
GRANT ALL ON public.aiq_drafts TO service_role;

COMMIT;

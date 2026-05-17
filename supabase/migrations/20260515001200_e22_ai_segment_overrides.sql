-- THS-42 (E2.2) — ai_segment_overrides: per-ticker AI revenue disclosures.
--
-- Why this table exists:
--   The G-score's AI-segment growth pillar is layer-specific (§Fix 4 of
--   docs/AI-Thesis-v2-Algorithm-and-Deployment.md). For names that disclose
--   an explicit AI / data-center / cloud revenue line, the engine reads
--   `ai_revenue` from this table. For names that don't, the engine falls
--   back to the layer default (e.g. L3 → AI ARR / total opex approximation
--   from fundamentals).
--
-- Curation discipline:
--   - disclosure_quality = 'explicit' → the company breaks out the figure
--     in 10-Q / earnings release / investor deck. Source URL required.
--   - disclosure_quality = 'derived' → the figure is back-computed from
--     a disclosed % share × disclosed total (e.g. TSMC's HPC = 61% of
--     revenue). Source URL required; show the math in `notes`.
--   - disclosure_quality = 'none' → row exists but `ai_revenue` is NULL.
--     Used to assert "we checked, the company does not disclose."
--
-- The hand-scored 20-name slate (§Part 3) gets seeded in a separate
-- migration from the disclosures cited in the spec doc rationale sections.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_segment_overrides (
  ticker                  text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  period_end              date NOT NULL,
  ai_revenue              numeric,
  ai_revenue_source_url   text,
  disclosure_quality      text NOT NULL CHECK (disclosure_quality IN ('explicit', 'derived', 'none')),
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, period_end)
);

COMMENT ON TABLE public.ai_segment_overrides IS
  'Per-ticker AI-segment revenue disclosures for the G-score AI pillar (THS-42). Curated; falls back to layer defaults when absent.';
COMMENT ON COLUMN public.ai_segment_overrides.ai_revenue IS
  'AI / data-center / cloud revenue for the period, in absolute USD (same currency unit as fundamentals_raw.revenue). NULL when disclosure_quality = ''none''.';
COMMENT ON COLUMN public.ai_segment_overrides.disclosure_quality IS
  '''explicit'' = company-disclosed line item; ''derived'' = back-computed from disclosed % × total; ''none'' = checked, not disclosed.';

CREATE INDEX IF NOT EXISTS ai_segment_overrides_ticker_period_desc_idx
  ON public.ai_segment_overrides (ticker, period_end DESC);

-- updated_at trigger so audits can see when a row was last revised.
CREATE OR REPLACE FUNCTION public.tg_ai_segment_overrides_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_segment_overrides_set_updated_at ON public.ai_segment_overrides;
CREATE TRIGGER ai_segment_overrides_set_updated_at
  BEFORE UPDATE ON public.ai_segment_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_ai_segment_overrides_set_updated_at();

-- RLS: same shape as the other overlay tables (THS-36). Service role
-- bypasses RLS; authenticated user can read; anon is blocked.
ALTER TABLE public.ai_segment_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_segment_overrides FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_segment_overrides_authenticated_all ON public.ai_segment_overrides;
CREATE POLICY ai_segment_overrides_authenticated_all
  ON public.ai_segment_overrides
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.ai_segment_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_segment_overrides TO authenticated;
GRANT ALL ON public.ai_segment_overrides TO service_role;

COMMIT;

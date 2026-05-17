-- THS-67 (E6.5) — Quarterly review checklist.
--
-- After each US earnings cycle a cron job (`compute-quarterly-review`)
-- generates a 5-check checklist:
--   1. New depreciation-extension / useful-life policy changes since
--      last review.
--   2. AIQ rubric drift > 10pt between the latest rubric and the prior
--      rubric per ticker.
--   3. Hyperscaler pairwise correlation movement > 0.20 between the
--      current 90-day window and the prior 90-day window.
--   4. Consensus 2026/2027 capex movement > 10% — surfaced as a data
--      gap until a consensus-capex column lands.
--   5. Annual walk-forward re-optimize trigger — fires on Q1 review.
--
-- Findings persist as a JSONB array on the quarterly_reviews row. The
-- /decisions page derives a `quarterly_review` alert from the latest
-- unreviewed row (notification surface).

BEGIN;

CREATE TABLE IF NOT EXISTS public.quarterly_reviews (
  as_of         date PRIMARY KEY,
  findings      jsonb NOT NULL,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  reviewed_note text
);

COMMENT ON TABLE public.quarterly_reviews IS
  'Quarterly checklist (5 checks). One row per quarter, keyed by as_of. findings is an array of {check_id, severity, summary, detail, data}. reviewed_at/reviewed_note populated when an operator acks the review on /decisions.';

CREATE INDEX IF NOT EXISTS quarterly_reviews_asof_desc_idx
  ON public.quarterly_reviews (as_of DESC);

CREATE INDEX IF NOT EXISTS quarterly_reviews_unreviewed_idx
  ON public.quarterly_reviews (as_of DESC) WHERE reviewed_at IS NULL;

ALTER TABLE public.quarterly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarterly_reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY quarterly_reviews_authenticated_all ON public.quarterly_reviews
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.quarterly_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quarterly_reviews TO authenticated;
GRANT ALL ON public.quarterly_reviews TO service_role;

COMMIT;

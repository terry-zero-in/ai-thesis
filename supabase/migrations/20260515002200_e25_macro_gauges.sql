-- THS-45 (E2.5) — macro_gauges: weekly NAAIM / AAII bull-bear spread /
-- CNN Fear & Greed snapshot used by the composite job to compute the
-- macro multiplier per spec §Fix 4 Bayesian gate table:
--   0 gates hit → 1.00     (NAAIM > 90 = 1 gate)
--   1 gate hit  → 0.95     (AAII 3-wk spread > 30 = 1 gate)
--   2 gates hit → 0.90     (Fear & Greed > 80 = 1 gate)
--   3 gates hit → 0.85
--
-- The spec wires three live fetchers (NAAIM XML, AAII page, F&G API).
-- For v1 we store operator-curated weekly values; live ingestion lands
-- as a follow-up (separate ticket, separate edge function — no
-- algorithm impact since the math is the same).
--
-- PK (as_of, source) lets you keep the spec's three gauges and also
-- store the same gauge from a backup source if needed.

BEGIN;

CREATE TABLE IF NOT EXISTS public.macro_gauges (
  as_of               date NOT NULL,
  naaim               numeric,
  aaii_3wk_spread     numeric,
  fear_greed          numeric,
  source_notes        text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (as_of)
);

COMMENT ON TABLE public.macro_gauges IS
  'Weekly macro sentiment snapshot for the composite-score macro multiplier (THS-45 / spec §Fix 4). One row per as_of date.';
COMMENT ON COLUMN public.macro_gauges.naaim IS
  'NAAIM Exposure Index (0..200). Gate hits at > 90.';
COMMENT ON COLUMN public.macro_gauges.aaii_3wk_spread IS
  'AAII bull-bear spread, three-week average. Gate hits at > 30.';
COMMENT ON COLUMN public.macro_gauges.fear_greed IS
  'CNN Fear & Greed index (0..100). Gate hits at > 80.';

ALTER TABLE public.macro_gauges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_gauges FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS macro_gauges_authenticated_all ON public.macro_gauges;
CREATE POLICY macro_gauges_authenticated_all
  ON public.macro_gauges
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.macro_gauges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.macro_gauges TO authenticated;
GRANT ALL ON public.macro_gauges TO service_role;

-- Seed: May 14 2026 reading from spec §Part 2 (NAAIM 96.67, AAII +5.36,
-- F&G 66). One gate hit → multiplier 0.95.
INSERT INTO public.macro_gauges (as_of, naaim, aaii_3wk_spread, fear_greed, source_notes)
VALUES (
  DATE '2026-05-14',
  96.67,
  5.36,
  66,
  'NAAIM (May 6), AAII (May 7), F&G (May 14). Spec §Part 2.'
)
ON CONFLICT (as_of) DO NOTHING;

COMMIT;

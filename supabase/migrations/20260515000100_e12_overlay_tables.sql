-- THS-36 (E1.2) — Overlay + output tables: aiq_rubric, depreciation_flags, scores_history
-- Refs: docs/AI-Thesis-v2-Algorithm-and-Deployment.md Part 4 (Supabase schema)
--
-- Depends on: 20260515000000_e11_init_core_tables.sql (universe must exist).

BEGIN;

-- ---------------------------------------------------------------------------
-- aiq_rubric: manual quarterly AIQ scoring across 6 dimensions
-- ---------------------------------------------------------------------------
-- The six dimensions sum to 100 by spec (20+20+15+15+15+15). The total column
-- is GENERATED ALWAYS STORED so it's always consistent with the components and
-- can be indexed/filtered like a normal column.

CREATE TABLE IF NOT EXISTS public.aiq_rubric (
  ticker             text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  scored_at          date NOT NULL,
  disclosure_pts     int  NOT NULL CHECK (disclosure_pts     BETWEEN 0 AND 20),
  defensibility_pts  int  NOT NULL CHECK (defensibility_pts  BETWEEN 0 AND 20),
  concentration_pts  int  NOT NULL CHECK (concentration_pts  BETWEEN 0 AND 15),
  capex_eff_pts      int  NOT NULL CHECK (capex_eff_pts      BETWEEN 0 AND 15),
  indep_demand_pts   int  NOT NULL CHECK (indep_demand_pts   BETWEEN 0 AND 15),
  accounting_pts     int  NOT NULL CHECK (accounting_pts     BETWEEN 0 AND 15),
  total              int  GENERATED ALWAYS AS (
    disclosure_pts + defensibility_pts + concentration_pts +
    capex_eff_pts + indep_demand_pts + accounting_pts
  ) STORED,
  notes              text,
  PRIMARY KEY (ticker, scored_at)
);

COMMENT ON TABLE public.aiq_rubric IS
  'Manually scored AIQ rubric, quarterly cadence. total is GENERATED from the six dimension columns.';

CREATE INDEX IF NOT EXISTS aiq_rubric_ticker_scored_desc_idx
  ON public.aiq_rubric (ticker, scored_at DESC);

CREATE INDEX IF NOT EXISTS aiq_rubric_total_idx
  ON public.aiq_rubric (total);

-- ---------------------------------------------------------------------------
-- depreciation_flags: hyperscaler depreciation-extension penalty tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.depreciation_flags (
  ticker                   text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  flagged_at               date NOT NULL,
  extension_years          numeric,  -- e.g., 1.5 = total years extended in this filing
  penalty_v                int,      -- the V-score penalty applied (negative number)
  burry_overstatement_pct  numeric,  -- earnings-overstatement estimate, percent
  source_url               text,
  PRIMARY KEY (ticker, flagged_at)
);

COMMENT ON TABLE public.depreciation_flags IS
  'Depreciation-extension and Burry-style overstatement flags. Drives V-score penalty in compute_v_score.';

CREATE INDEX IF NOT EXISTS depreciation_flags_ticker_flagged_desc_idx
  ON public.depreciation_flags (ticker, flagged_at DESC);

-- ---------------------------------------------------------------------------
-- scores_history: per-ticker computed scores, one row per (ticker, as_of)
-- ---------------------------------------------------------------------------
-- factor_breakdown is the full per-factor decomposition the UI reads from.
-- layer_weights is the resolved weight set for that run (Tier-A rescaled or
-- full six-factor depending on engine version). Both are JSONB and indexed
-- with GIN so containment / key lookups stay fast.

CREATE TABLE IF NOT EXISTS public.scores_history (
  ticker            text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  as_of             date NOT NULL,
  q_score           numeric,
  g_score           numeric,
  v_score           numeric,
  v_penalty         numeric NOT NULL DEFAULT 0,
  aiq_score         numeric,
  m_score           numeric,  -- null until engine v2
  s_score           numeric,  -- null until engine v2
  layer_weights     jsonb,
  composite         numeric,
  macro_gates_hit   int NOT NULL DEFAULT 0 CHECK (macro_gates_hit BETWEEN 0 AND 3),
  macro_multiplier  numeric NOT NULL DEFAULT 1.0,
  final_score       numeric,
  tier              text CHECK (tier IN ('High', 'Medium', 'Low', 'Avoid')),
  factor_breakdown  jsonb,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, as_of)
);

COMMENT ON TABLE public.scores_history IS
  'Per-ticker composite scores and tier classifications. factor_breakdown holds the full UI decomposition.';

CREATE INDEX IF NOT EXISTS scores_history_asof_desc_idx
  ON public.scores_history (as_of DESC);

CREATE INDEX IF NOT EXISTS scores_history_tier_idx
  ON public.scores_history (tier, as_of DESC) WHERE tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS scores_history_final_score_desc_idx
  ON public.scores_history (as_of DESC, final_score DESC);

CREATE INDEX IF NOT EXISTS scores_history_factor_breakdown_gin_idx
  ON public.scores_history USING gin (factor_breakdown jsonb_path_ops);

CREATE INDEX IF NOT EXISTS scores_history_layer_weights_gin_idx
  ON public.scores_history USING gin (layer_weights jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.aiq_rubric          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depreciation_flags  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores_history      ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.aiq_rubric          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.depreciation_flags  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scores_history      FORCE ROW LEVEL SECURITY;

CREATE POLICY aiq_rubric_authenticated_all ON public.aiq_rubric
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY depreciation_flags_authenticated_all ON public.depreciation_flags
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY scores_history_authenticated_all ON public.scores_history
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Privilege grants (mirrors THS-35 pattern)
-- ---------------------------------------------------------------------------
GRANT SELECT ON
  public.aiq_rubric,
  public.depreciation_flags,
  public.scores_history
TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.aiq_rubric,
  public.depreciation_flags,
  public.scores_history
TO authenticated;

GRANT ALL ON
  public.aiq_rubric,
  public.depreciation_flags,
  public.scores_history
TO service_role;

COMMIT;

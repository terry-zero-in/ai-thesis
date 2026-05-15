-- THS-45 — RPC for the composite job to write the derived columns
-- (composite, final_score, tier, macro_*) AND merge a 'composite' slice
-- into factor_breakdown without disturbing the per-factor slices
-- (q, g, v, aiq) written by the per-factor jobs.
--
-- Why a separate RPC vs upsert_factor_score: factor_breakdown carries
-- multiple top-level keys (q, g, v, aiq, composite) and the composite
-- write needs to set five additional regular columns. The factor RPC
-- only writes one score column per call. Keeping these orthogonal so
-- neither RPC has to grow a discriminating mode flag.

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_composite_score(
  p_ticker            text,
  p_as_of             date,
  p_composite         numeric,
  p_final_score       numeric,
  p_tier              text,
  p_macro_gates_hit   int,
  p_macro_multiplier  numeric,
  p_layer_weights     jsonb,
  p_breakdown         jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.scores_history AS sh (
    ticker, as_of,
    composite, final_score, tier,
    macro_gates_hit, macro_multiplier,
    layer_weights, factor_breakdown
  )
  VALUES (
    p_ticker, p_as_of,
    p_composite, p_final_score, p_tier,
    p_macro_gates_hit, p_macro_multiplier,
    p_layer_weights, jsonb_build_object('composite', p_breakdown)
  )
  ON CONFLICT (ticker, as_of) DO UPDATE SET
    composite        = EXCLUDED.composite,
    final_score      = EXCLUDED.final_score,
    tier             = EXCLUDED.tier,
    macro_gates_hit  = EXCLUDED.macro_gates_hit,
    macro_multiplier = EXCLUDED.macro_multiplier,
    layer_weights    = EXCLUDED.layer_weights,
    factor_breakdown = COALESCE(sh.factor_breakdown, '{}'::jsonb)
                       || jsonb_build_object('composite', p_breakdown);
END;
$$;

COMMENT ON FUNCTION public.upsert_composite_score(text, date, numeric, numeric, text, int, numeric, jsonb, jsonb) IS
  'Composite writer for scores_history. Sets composite/final_score/tier/macro columns and merges a composite slice under factor_breakdown.composite; preserves q/g/v/aiq slices written by per-factor jobs. Service-role only.';

REVOKE ALL ON FUNCTION public.upsert_composite_score(text, date, numeric, numeric, text, int, numeric, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_composite_score(text, date, numeric, numeric, text, int, numeric, jsonb, jsonb) TO service_role;

COMMIT;

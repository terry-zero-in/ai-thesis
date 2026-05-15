// THS-45 — Weekly composite score job.
// Reads q/g/v from scores_history (written by the per-factor jobs earlier
// in the same Saturday run) + AIQ from aiq_rubric + macro_gauges, applies
// the per-layer weights with Tier-A rescale, applies the macro multiplier
// to High composites only, classifies tier, and writes via the
// upsert_composite_score RPC.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import {
  computeComposite,
  LAYER_WEIGHTS,
  type CompositeResult,
} from "../_shared/composite.ts";
import { loadCompositeInputs, serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  as_of?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = Date.now();
  try {
    requireCronAuth(req);

    let body: RequestBody = {};
    if (req.method !== "GET") {
      const text = await req.text();
      if (text.trim().length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new HttpError(400, "request body must be JSON or empty");
        }
      }
    }
    const asOf = body.as_of ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      throw new HttpError(400, `as_of must be YYYY-MM-DD (got "${asOf}")`);
    }

    const client = serviceClient();
    const { inputs, gauges, gaugesAsOf } = await loadCompositeInputs(client, asOf);

    let rowsUpserted = 0;
    let nullCount = 0;
    const tierTallies: Record<string, number> = {
      High: 0, Medium: 0, Low: 0, Avoid: 0, null: 0,
    };

    for (const inp of inputs) {
      const result = computeComposite(inp.ticker, inp.layer, inp.scores, gauges);
      tierTallies[result.tier ?? "null"] += 1;
      if (result.composite === null) nullCount += 1;

      const { error } = await client.rpc("upsert_composite_score", {
        p_ticker: inp.ticker,
        p_as_of: asOf,
        p_composite: result.composite,
        p_final_score: result.finalScore,
        p_tier: result.tier,
        p_macro_gates_hit: result.macroGatesHit,
        p_macro_multiplier: result.macroMultiplier,
        p_layer_weights: LAYER_WEIGHTS[inp.layer],
        p_breakdown: buildBreakdown(inp.scores, result),
      });
      if (error) throw error;
      rowsUpserted += 1;
    }

    // All tickers in one run share the same macro gauges, so pull
    // gates-hit / multiplier from the first non-null result for the report.
    const sampleResult = inputs.length > 0
      ? computeComposite(inputs[0].ticker, inputs[0].layer, inputs[0].scores, gauges)
      : null;

    return Response.json({
      ok: true,
      as_of: asOf,
      macro_gauges_as_of: gaugesAsOf,
      macro_gates_hit: sampleResult?.macroGatesHit ?? null,
      macro_multiplier: sampleResult?.macroMultiplier ?? null,
      tickers_scored: inputs.length,
      rows_upserted: rowsUpserted,
      null_composites: nullCount,
      tiers: tierTallies,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

function buildBreakdown(
  scores: { q: number | null; g: number | null; v: number | null; aiq: number | null; m: number | null; s: number | null },
  result: CompositeResult,
) {
  return {
    inputs: scores,
    resolved_weights: result.resolvedWeights,
    macro_gates_hit: result.macroGatesHit,
    macro_multiplier: result.macroMultiplier,
    pre_multiplier: result.composite,
    post_multiplier: result.finalScore,
    tier: result.tier,
  };
}

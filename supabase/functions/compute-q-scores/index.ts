// THS-41 — Weekly Q-score compute job.
// Loads the latest fundamentals + prices for the investable universe at the
// requested `as_of` (default today), runs `computeQForCohort` per layer, and
// upserts results into `scores_history`. Other Tier-A factors (G, V, AIQ)
// come online with their own sub-issues; this writer touches only `q_score`,
// `factor_breakdown.q`, and `factor_breakdown.q_metrics` for now.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { computeQForCohort, type Layer } from "../_shared/factor-q.ts";
import { loadQInputsByLayer, serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  as_of?: string; // ISO YYYY-MM-DD
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
    const byLayer = await loadQInputsByLayer(client, asOf);

    let tickersScored = 0;
    let rowsUpserted = 0;
    const perLayer: Array<{ layer: Layer; count: number }> = [];

    for (const [layer, inputs] of byLayer.entries()) {
      if (inputs.length === 0) continue;
      const results = computeQForCohort(inputs);
      tickersScored += results.length;
      perLayer.push({ layer, count: results.length });

      // Write each ticker via the merge-aware RPC so peer factors' JSONB
      // slices (g, v, aiq, …) aren't trampled. Sequential is fine — one
      // weekly run is at most 50 names per layer.
      for (const r of results) {
        const { error } = await client.rpc("upsert_factor_score", {
          p_ticker: r.ticker,
          p_as_of: asOf,
          p_factor: "q",
          p_score: r.qScore,
          p_breakdown: {
            composite_z: r.compositeZ,
            pillars: r.pillars,
            metrics: r.metrics,
          },
        });
        if (error) throw error;
        rowsUpserted += 1;
      }
    }

    return Response.json({
      ok: true,
      as_of: asOf,
      tickers_scored: tickersScored,
      rows_upserted: rowsUpserted,
      per_layer: perLayer,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});


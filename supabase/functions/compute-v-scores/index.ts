// THS-43 — Weekly V-score compute job.
// Loads TTM aggregates + latest balance sheet + market cap + consensus +
// forward P/E history + depreciation flags, runs `computeVForCohort` per
// layer, and writes via `upsert_factor_score` so Q/G slices in
// factor_breakdown survive.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { computeVForCohort, type Layer } from "../_shared/factor-v.ts";
import { loadVInputsByLayer, serviceClient } from "../_shared/supabase.ts";

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
    const byLayer = await loadVInputsByLayer(client, asOf);

    let tickersScored = 0;
    let rowsUpserted = 0;
    const perLayer: Array<{ layer: Layer; count: number }> = [];

    for (const [layer, inputs] of byLayer.entries()) {
      if (inputs.length === 0) continue;
      const results = computeVForCohort(inputs);
      tickersScored += results.length;
      perLayer.push({ layer, count: results.length });

      for (const r of results) {
        const { error } = await client.rpc("upsert_factor_score", {
          p_ticker: r.ticker,
          p_as_of: asOf,
          p_factor: "v",
          p_score: r.vScore,
          p_breakdown: {
            composite_z: r.compositeZ,
            raw_v: r.rawV,
            penalty: r.penalty,
            signals: r.signals,
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

// THS-41 — Weekly Q-score compute job.
// Loads the latest fundamentals + prices for the investable universe at the
// requested `as_of` (default today), runs `computeQForCohort` per layer, and
// upserts results into `scores_history`. Other Tier-A factors (G, V, AIQ)
// come online with their own sub-issues; this writer touches only `q_score`,
// `factor_breakdown.q`, and `factor_breakdown.q_metrics` for now.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { computeQForCohort, type Layer, type QResult } from "../_shared/factor-q.ts";
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

      const rows = results.map((r) => toScoresHistoryRow(r, asOf));
      // Upsert each ticker's row. We only set the q_* fields here so the
      // composite + final_score remain whatever the engine wrote last; the
      // composite update lands with THS-45.
      const { error } = await client
        .from("scores_history")
        .upsert(rows, { onConflict: "ticker,as_of" });
      if (error) throw error;
      rowsUpserted += rows.length;
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

function toScoresHistoryRow(r: QResult, asOf: string) {
  return {
    ticker: r.ticker,
    as_of: asOf,
    q_score: r.qScore,
    factor_breakdown: {
      q: {
        composite_z: r.compositeZ,
        pillars: r.pillars,
        metrics: r.metrics,
      },
    },
  };
}

// THS-62 — Weekly S-score compute job.
//
// Loads revisions delta + SUSI + insider cluster override for the
// investable universe (options skew is null until THS-59 ships) and
// runs `computeSForCohort`. Writes via the merge-aware upsert_factor_score
// RPC so other factors' breakdown slices survive.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { computeSForCohort } from "../_shared/factor-s.ts";
import { loadSInputs, serviceClient } from "../_shared/supabase.ts";

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
    const inputs = await loadSInputs(client, asOf);

    if (inputs.length === 0) {
      return Response.json({
        ok: true,
        as_of: asOf,
        tickers_scored: 0,
        rows_upserted: 0,
        elapsed_ms: Date.now() - startedAt,
      });
    }

    const results = computeSForCohort(inputs);
    let rowsUpserted = 0;
    const coverage = { revisions_delta: 0, options_skew: 0, susi_z: 0, insider_override: 0 };
    let buyClusterCount = 0;
    let sellClusterCount = 0;

    for (const r of results) {
      if (r.signals.revisions_delta != null) coverage.revisions_delta++;
      if (r.signals.options_skew != null) coverage.options_skew++;
      if (r.signals.susi_z != null) coverage.susi_z++;
      if (r.signals.insider_override != null) {
        coverage.insider_override++;
        if (r.signals.insider_override > 0) buyClusterCount++;
        else if (r.signals.insider_override < 0) sellClusterCount++;
      }
      const { error } = await client.rpc("upsert_factor_score", {
        p_ticker: r.ticker,
        p_as_of: asOf,
        p_factor: "s",
        p_score: r.sScore,
        p_breakdown: {
          composite_z: r.compositeZ,
          signals: r.signals,
        },
      });
      if (error) throw error;
      rowsUpserted += 1;
    }

    return Response.json({
      ok: true,
      as_of: asOf,
      tickers_scored: results.length,
      rows_upserted: rowsUpserted,
      coverage,
      insider_clusters: { buy: buyClusterCount, sell: sellClusterCount },
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

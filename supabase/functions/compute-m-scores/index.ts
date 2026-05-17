// THS-58 — Weekly M-score compute job.
//
// Loads price snapshots (±13mo / ±1mo), latest quarterly EPS, pre-report
// consensus EPS, and 30-day upward-revision breadth for the investable
// universe at the requested as_of, runs `computeMForCohort` over the
// flat cohort (momentum is cross-sectional, not per-layer), and upserts
// results into `scores_history` via the merge-aware RPC.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { computeMForCohort } from "../_shared/factor-m.ts";
import { loadMInputs, serviceClient } from "../_shared/supabase.ts";

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
    const inputs = await loadMInputs(client, asOf);

    if (inputs.length === 0) {
      return Response.json({
        ok: true,
        as_of: asOf,
        tickers_scored: 0,
        rows_upserted: 0,
        elapsed_ms: Date.now() - startedAt,
        note: "No investable universe at this as_of.",
      });
    }

    const results = computeMForCohort(inputs);
    let rowsUpserted = 0;
    let withSue = 0;
    let withPrice = 0;
    let withBreadth = 0;

    for (const r of results) {
      if (r.signals.price12_1 != null) withPrice++;
      if (r.signals.sue != null) withSue++;
      if (r.signals.revBreadth != null) withBreadth++;
      const { error } = await client.rpc("upsert_factor_score", {
        p_ticker: r.ticker,
        p_as_of: asOf,
        p_factor: "m",
        p_score: r.mScore,
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
      coverage: {
        price12_1: withPrice,
        sue: withSue,
        revBreadth: withBreadth,
      },
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

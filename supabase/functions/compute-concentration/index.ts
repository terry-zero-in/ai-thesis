// THS-63 — Weekly concentration-tax compute job.
//
// Loads 120-day daily returns + supply-chain edges for the investable
// universe and runs `computeConcentrationTax`. Writes one row per ticker
// into `concentration_history` (as_of, tax, breakdown JSONB with signals
// and percentile ranks).

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { computeConcentrationTax } from "../_shared/concentration.ts";
import { loadConcentrationInputs, serviceClient } from "../_shared/supabase.ts";

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
    const inputs = await loadConcentrationInputs(client, asOf);

    if (inputs.returns.size === 0) {
      return Response.json({
        ok: true,
        as_of: asOf,
        tickers_scored: 0,
        rows_upserted: 0,
        elapsed_ms: Date.now() - startedAt,
        note: "No tickers have ≥ 30 days of price history.",
      });
    }

    const results = computeConcentrationTax(inputs);
    const payload = results.map((r) => ({
      ticker: r.ticker,
      as_of: asOf,
      tax: r.tax,
      breakdown: { signals: r.signals },
    }));
    const upsertRes = await client
      .from("concentration_history")
      .upsert(payload, { onConflict: "ticker,as_of" });
    if (upsertRes.error) throw upsertRes.error;

    const deepestTax = results.reduce((m, r) => (r.tax < m.tax ? r : m), results[0]);
    return Response.json({
      ok: true,
      as_of: asOf,
      tickers_scored: results.length,
      rows_upserted: payload.length,
      deepest: { ticker: deepestTax.ticker, tax: deepestTax.tax },
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

// THS-59 — Daily options surface ingest (Polygon).
//
// For each investable ticker: pull the full options chain snapshot via
// `fetchOptionsSnapshot`, compute the 3 surface signals via
// `computeOptionsMetrics`, upsert to `options_raw`. Daily cron.
//
// Polygon Starter rate limits aren't a real concern at 70 tickers ×
// 1 call/day, but we pace at ~250ms between symbols defensively so
// nothing pathological happens during initial backfill (when somebody
// might invoke with `?days=`-style spam).

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { computeOptionsMetrics } from "../_shared/options-metrics.ts";
import { fetchOptionsSnapshot } from "../_shared/polygon.ts";
import { activeTickers, serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  as_of?: string;
}

const PACE_MS = 250;

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
    const tickers = await activeTickers(client, { kind: "investable" });

    let rowsUpserted = 0;
    let nullMetrics = 0;
    const failures: Array<{ ticker: string; error: string }> = [];

    for (const ticker of tickers) {
      try {
        const contracts = await fetchOptionsSnapshot(ticker, { asOf });
        const metrics = computeOptionsMetrics(contracts);
        if (metrics.put_call_ratio == null && metrics.skew_25d == null && metrics.iv_term_slope == null) {
          nullMetrics += 1;
        }
        const { error } = await client.from("options_raw").upsert(
          {
            ticker,
            as_of: asOf,
            put_call_ratio: metrics.put_call_ratio,
            skew_25d: metrics.skew_25d,
            iv_term_slope: metrics.iv_term_slope,
            contracts_count: metrics.contracts_used,
            raw: null, // keep payload small; chain is hundreds of rows per ticker
          },
          { onConflict: "ticker,as_of" },
        );
        if (error) throw error;
        rowsUpserted += 1;
        await sleep(PACE_MS);
      } catch (e) {
        failures.push({ ticker, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const ok = failures.length === 0;
    return Response.json(
      {
        ok,
        as_of: asOf,
        tickers: tickers.length,
        rows_upserted: rowsUpserted,
        null_metrics: nullMetrics,
        failures,
        elapsed_ms: Date.now() - startedAt,
      },
      { status: ok ? 200 : 207 },
    );
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

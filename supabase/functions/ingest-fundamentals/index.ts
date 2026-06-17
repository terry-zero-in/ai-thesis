// THS-38 — Daily FMP fundamentals ingestion.
// Invoked by pg_cron after market close. Bearer-token guarded.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { fetchFundamentals } from "../_shared/fmp.ts";
import { activeTickers, INGEST_KINDS, serviceClient } from "../_shared/supabase.ts";

// Deno.serve is the Supabase Edge Function entrypoint.
declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = Date.now();
  try {
    requireCronAuth(req);
    const client = serviceClient();
    // investable + hp1 (HP-1 Core overlay needs fundamentals for its 19 names).
    const tickers = await activeTickers(client, { kinds: INGEST_KINDS });

    let rowsUpserted = 0;
    const failures: Array<{ ticker: string; error: string }> = [];

    // Sequential to avoid hammering FMP. ~50 tickers * ~600ms each ≈ 30s,
    // well within the Edge Function 60s budget.
    for (const ticker of tickers) {
      try {
        const rows = await fetchFundamentals(ticker, { quarters: 8, annuals: 3 });
        if (rows.length === 0) continue;
        const { error } = await client
          .from("fundamentals_raw")
          .upsert(rows, { onConflict: "ticker,period_end,period_type" });
        if (error) throw error;
        rowsUpserted += rows.length;
      } catch (e) {
        failures.push({ ticker, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const elapsed_ms = Date.now() - startedAt;
    return Response.json({
      ok: failures.length === 0,
      tickers: tickers.length,
      rows_upserted: rowsUpserted,
      failures,
      elapsed_ms,
    }, { status: failures.length === 0 ? 200 : 207 });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

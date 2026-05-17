// THS-40 — Daily OHLCV ingestion + 12-1 momentum view refresh.
//
// Accepts an optional `?days=N` query parameter (default 30). For the
// initial backfill, invoke with days=400 to seed ~1 year + buffer.
//
// After upserting all prices, calls refresh_momentum_12_1() RPC to recompute
// the matview.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { fetchHistoricalPrices, fetchVixHistory } from "../_shared/fmp.ts";
import { activeTickers, serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

const DAY = 24 * 60 * 60 * 1000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = Date.now();
  try {
    requireCronAuth(req);
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(2000, Number(url.searchParams.get("days") ?? 30)));
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY);

    const client = serviceClient();
    // Investable + benchmark — we want SPY too.
    const tickers = await activeTickers(client, { kind: "all" });

    let rowsUpserted = 0;
    const failures: Array<{ ticker: string; error: string }> = [];

    for (const ticker of tickers) {
      try {
        // ^-prefixed symbols (e.g. ^VIX) are indices — FMP's stable EOD
        // endpoint returns sparse data for them; use the legacy
        // historical-price-full endpoint instead.
        const rows = ticker.startsWith("^")
          ? await fetchVixHistory(isoDate(from), isoDate(to))
          : await fetchHistoricalPrices(ticker, isoDate(from), isoDate(to));
        if (rows.length === 0) continue;
        const { error } = await client
          .from("prices_raw")
          .upsert(rows, { onConflict: "ticker,date" });
        if (error) throw error;
        rowsUpserted += rows.length;
      } catch (e) {
        failures.push({ ticker, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Refresh the momentum view. Failure here doesn't roll back the prices
    // ingest — we surface it in the response and let the cron log catch it.
    let viewRefreshed = false;
    let refreshError: string | null = null;
    try {
      const { error } = await client.rpc("refresh_momentum_12_1");
      if (error) throw error;
      viewRefreshed = true;
    } catch (e) {
      refreshError = e instanceof Error ? e.message : String(e);
    }

    const ok = failures.length === 0 && viewRefreshed;
    return Response.json({
      ok,
      days,
      tickers: tickers.length,
      rows_upserted: rowsUpserted,
      view_refreshed: viewRefreshed,
      refresh_error: refreshError,
      failures,
      elapsed_ms: Date.now() - startedAt,
    }, { status: ok ? 200 : 207 });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

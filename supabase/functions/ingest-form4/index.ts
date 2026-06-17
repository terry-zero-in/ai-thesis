// THS-61 — Daily insider Form-4 ingestion.
//
// For each active investable ticker, fetches the most recent 100 Form-4
// transactions from FMP and UPSERTs into insider_form4_raw. The PK
// (ticker, transaction_date, insider_name, transaction_code, shares)
// makes re-ingest idempotent — a daily pull of the trailing window
// safely refreshes without dupes.
//
// 10b5-1 detection is not done here (FMP doesn't expose it). is_10b5_1
// is left null; the cluster detector in factor-insider.ts treats null
// conservatively. Backfilling the flag is a separate follow-on
// (fetching + parsing the SEC link footnote).

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { fetchInsiderTrades, type InsiderFilingRow } from "../_shared/fmp.ts";
import { INGEST_KINDS, serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  tickers?: string[];
  limit?: number;
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
    const limit = body.limit ?? 100;

    const client = serviceClient();
    const univRes = await client
      .from("universe")
      .select("ticker")
      .eq("is_active", true)
      .in("kind", INGEST_KINDS) // investable + hp1 (Fable §4.E insider clusters cover HP-1 names)
      .order("ticker");
    if (univRes.error) throw univRes.error;
    let tickers = (univRes.data ?? []).map((r) => (r as { ticker: string }).ticker);
    if (body.tickers && body.tickers.length > 0) {
      const allow = new Set(body.tickers);
      tickers = tickers.filter((t) => allow.has(t));
    }

    let rowsUpserted = 0;
    const failed: Array<{ ticker: string; error: string }> = [];

    for (const ticker of tickers) {
      try {
        const rows = await fetchInsiderTrades(ticker, limit);
        if (rows.length === 0) continue;
        // Strip the `raw` jsonb out into its own field; supabase-js accepts it
        // as nested JSONB on the row.
        const payload = rows.map((r: InsiderFilingRow) => ({
          ticker: r.ticker,
          transaction_date: r.transaction_date,
          insider_name: r.insider_name,
          insider_title: r.insider_title,
          transaction_code: r.transaction_code,
          acquired_disposed: r.acquired_disposed,
          shares: r.shares,
          price_per_share: r.price_per_share,
          transaction_value: r.transaction_value,
          is_10b5_1: r.is_10b5_1,
          source_url: r.source_url,
          filing_date: r.filing_date,
          raw: r.raw,
        }));
        const upsertRes = await client
          .from("insider_form4_raw")
          .upsert(payload, {
            onConflict: "ticker,transaction_date,insider_name,transaction_code,shares",
          });
        if (upsertRes.error) throw upsertRes.error;
        rowsUpserted += payload.length;
      } catch (e) {
        failed.push({ ticker, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return Response.json({
      ok: failed.length === 0,
      tickers_attempted: tickers.length,
      rows_upserted: rowsUpserted,
      failed,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

// THS-60 — Twice-monthly short-interest ingestion.
//
// For each active investable ticker:
//   1. Pull recent FMP short-interest snapshots (limit=60 ≈ 2.5 years of
//      bi-monthly observations — covers the 24mo SUSI baseline + backfill).
//   2. UPSERT into short_interest_raw on (ticker, settlement_date).
//   3. After upsert, compute SUSI z-score from the trailing 24mo history
//      and write it back into the latest row only.
//
// On first run (empty table for a ticker), step 1 backfills the full
// available history; subsequent runs only need the latest 2-4
// observations but pulling 60 each run is cheap and self-healing.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { fetchShortInterest, type ShortInterestRow } from "../_shared/fmp.ts";
import { computeSusi, type SiObservation } from "../_shared/susi.ts";
import { INGEST_KINDS, serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  tickers?: string[];
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

    const client = serviceClient();

    // Universe scope: investable + hp1 (HP-1 names need SUSI for Fable §4.F; excludes SPY benchmark / macro).
    const univRes = await client
      .from("universe")
      .select("ticker")
      .eq("is_active", true)
      .in("kind", INGEST_KINDS)
      .order("ticker");
    if (univRes.error) throw univRes.error;
    let tickers = (univRes.data ?? []).map((r) => (r as { ticker: string }).ticker);
    if (body.tickers && body.tickers.length > 0) {
      const allow = new Set(body.tickers);
      tickers = tickers.filter((t) => allow.has(t));
    }

    let rowsUpserted = 0;
    let susiUpdated = 0;
    const failed: Array<{ ticker: string; error: string }> = [];

    for (const ticker of tickers) {
      try {
        const rows = await fetchShortInterest(ticker, 60);
        if (rows.length === 0) continue;
        const upsertRes = await client
          .from("short_interest_raw")
          .upsert(rows, { onConflict: "ticker,settlement_date" });
        if (upsertRes.error) throw upsertRes.error;
        rowsUpserted += rows.length;

        // Recompute SUSI for the latest observation and store it.
        const history: SiObservation[] = rows.map((r: ShortInterestRow) => ({
          settlement_date: r.settlement_date,
          short_interest: r.short_interest,
        }));
        const latest = history.slice().sort((a, b) =>
          a.settlement_date < b.settlement_date ? 1 : -1,
        )[0];
        const z = computeSusi(history);
        if (latest && z != null && Number.isFinite(z)) {
          const updateRes = await client
            .from("short_interest_raw")
            .update({ susi_z: z })
            .eq("ticker", ticker)
            .eq("settlement_date", latest.settlement_date);
          if (updateRes.error) throw updateRes.error;
          susiUpdated += 1;
        }
      } catch (e) {
        failed.push({ ticker, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return Response.json({
      ok: failed.length === 0,
      tickers_attempted: tickers.length,
      rows_upserted: rowsUpserted,
      susi_updated: susiUpdated,
      failed,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

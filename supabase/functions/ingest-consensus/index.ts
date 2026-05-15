// THS-39 — Daily consensus + revisions ingestion.
//   1. Pull FMP analyst estimates, price-target, and rating consensus
//   2. Upsert today's row into `consensus`
//   3. Query 30d-ago and 90d-ago consensus rows for the same ticker
//   4. Compute FY1 EPS deltas and upsert into `revisions`
//
// upward_breadth_pct is left NULL for now — the FMP upgrade/downgrade-feed
// integration is a follow-up. Documented in docs/schema.md.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import {
  buildConsensusRow,
  fetchAnalystEstimates,
  fetchPriceTargetConsensus,
  fetchRatingConsensus,
  type ConsensusRow,
} from "../_shared/fmp.ts";
import { computeRevisionDeltas, type SnapshotPoint } from "../_shared/revisions.ts";
import { activeTickers, serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = Date.now();
  try {
    requireCronAuth(req);
    const client = serviceClient();
    const tickers = await activeTickers(client);
    const today = todayISO();

    let consensusUpserted = 0;
    let revisionsUpserted = 0;
    const failures: Array<{ ticker: string; error: string }> = [];

    for (const ticker of tickers) {
      try {
        const [estimates, target, rating] = await Promise.all([
          fetchAnalystEstimates(ticker, 4),
          fetchPriceTargetConsensus(ticker),
          fetchRatingConsensus(ticker),
        ]);

        const row: ConsensusRow = buildConsensusRow(ticker, today, estimates, target, rating);

        const { error: consErr } = await client
          .from("consensus")
          .upsert(row, { onConflict: "ticker,as_of" });
        if (consErr) throw consErr;
        consensusUpserted += 1;

        // Pull history (~last 120 days) so the 90d-ago snapshot is in scope.
        // We over-fetch on purpose so weekends/holidays around the cutoff are
        // handled by pickAtOrBefore in computeRevisionDeltas.
        const { data: history, error: histErr } = await client
          .from("consensus")
          .select("as_of, fy1_eps")
          .eq("ticker", ticker)
          .lt("as_of", today)
          .order("as_of", { ascending: false })
          .limit(120);
        if (histErr) throw histErr;

        const todayPoint: SnapshotPoint = { as_of: today, fy1_eps: row.fy1_eps };
        const deltas = computeRevisionDeltas(todayPoint, (history ?? []) as SnapshotPoint[]);

        const { error: revErr } = await client.from("revisions").upsert({
          ticker,
          as_of: today,
          fy1_eps_30d_pct_change: deltas.fy1_eps_30d_pct_change,
          fy1_eps_90d_pct_change: deltas.fy1_eps_90d_pct_change,
          upward_breadth_pct: null,
        }, { onConflict: "ticker,as_of" });
        if (revErr) throw revErr;
        revisionsUpserted += 1;
      } catch (e) {
        failures.push({ ticker, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return Response.json({
      ok: failures.length === 0,
      tickers: tickers.length,
      consensus_upserted: consensusUpserted,
      revisions_upserted: revisionsUpserted,
      failures,
      elapsed_ms: Date.now() - startedAt,
    }, { status: failures.length === 0 ? 200 : 207 });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

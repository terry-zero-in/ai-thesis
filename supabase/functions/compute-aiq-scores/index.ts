// THS-45-followup — AIQ-score denormalizer.
//
// AIQ is the only Tier-A factor that isn't computed from market data — it's
// manually scored quarterly into `aiq_rubric` (or generated as a draft and
// promoted). This job mirrors compute-{q,g,v,m,s}-scores: for each
// investable ticker at as_of, find the latest aiq_rubric row ≤ as_of and
// stamp its total into scores_history.aiq_score, with the per-dimension
// breakdown under factor_breakdown.aiq.
//
// Why this is needed even though compute-composite-scores reads aiq_rubric
// directly: scores_history.aiq_score is the denormalized per-factor column
// the UI reads for sparkline / table / detail surfaces. composite is correct
// without this job, but per-factor surfaces show null without it.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { activeTickers, serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  as_of?: string;
}

interface AiqRubricFull {
  ticker: string;
  scored_at: string;
  disclosure_pts: number;
  defensibility_pts: number;
  concentration_pts: number;
  capex_eff_pts: number;
  indep_demand_pts: number;
  accounting_pts: number;
  total: number;
  notes: string | null;
  disclosure_note: string | null;
  defensibility_note: string | null;
  concentration_note: string | null;
  capex_eff_note: string | null;
  indep_demand_note: string | null;
  accounting_note: string | null;
  sources: Record<string, string> | null;
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
    const tickers = await activeTickers(client, { kind: "investable" });

    // One round-trip for all aiq_rubric rows ≤ as_of for our tickers,
    // then bucket latest-per-ticker in memory. Quarterly cadence keeps
    // this table small (<1k rows even after years of history).
    const aiqRes = await client
      .from("aiq_rubric")
      .select(
        "ticker, scored_at, disclosure_pts, defensibility_pts, concentration_pts, capex_eff_pts, indep_demand_pts, accounting_pts, total, notes, disclosure_note, defensibility_note, concentration_note, capex_eff_note, indep_demand_note, accounting_note, sources",
      )
      .lte("scored_at", asOf)
      .in("ticker", tickers)
      .order("ticker")
      .order("scored_at", { ascending: false });
    if (aiqRes.error) throw aiqRes.error;

    const latest = new Map<string, AiqRubricFull>();
    for (const row of (aiqRes.data ?? []) as AiqRubricFull[]) {
      if (!latest.has(row.ticker)) latest.set(row.ticker, row);
    }

    let rowsUpserted = 0;
    let tickersWithoutRubric = 0;

    for (const ticker of tickers) {
      const r = latest.get(ticker);
      if (!r) {
        tickersWithoutRubric += 1;
        continue;
      }

      const breakdown = {
        scored_at: r.scored_at,
        total: r.total,
        dimensions: {
          disclosure: r.disclosure_pts,
          defensibility: r.defensibility_pts,
          concentration: r.concentration_pts,
          capex_eff: r.capex_eff_pts,
          indep_demand: r.indep_demand_pts,
          accounting: r.accounting_pts,
        },
        notes: {
          general: r.notes,
          disclosure: r.disclosure_note,
          defensibility: r.defensibility_note,
          concentration: r.concentration_note,
          capex_eff: r.capex_eff_note,
          indep_demand: r.indep_demand_note,
          accounting: r.accounting_note,
        },
        sources: r.sources,
      };

      const { error } = await client.rpc("upsert_factor_score", {
        p_ticker: ticker,
        p_as_of: asOf,
        p_factor: "aiq",
        p_score: r.total,
        p_breakdown: breakdown,
      });
      if (error) throw error;
      rowsUpserted += 1;
    }

    return Response.json({
      ok: true,
      as_of: asOf,
      tickers_in_universe: tickers.length,
      tickers_with_rubric: rowsUpserted,
      tickers_without_rubric: tickersWithoutRubric,
      rows_upserted: rowsUpserted,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

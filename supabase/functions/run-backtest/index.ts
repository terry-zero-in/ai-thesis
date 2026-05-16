// THS-64 — On-demand backtest runner.
//
// Reads scores_history (final_score) + prices_raw across the requested
// 5-year window, derives monthly rebalance dates from the available
// data, calls `runBacktest`, and returns a JSON report. Persists nothing
// — the report is the output. If the operator wants to retain runs, a
// follow-on can write to a `backtest_runs` table.
//
// Not on a cron — explicitly triggered (sensitive operation, expensive
// query). Call with `{"start": "2021-01-01", "end": "2026-01-01"}`.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { runBacktest, type ReturnObs, type ScoreObs } from "../_shared/backtest.ts";
import { serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  start?: string;
  end?: string;
  top_n?: number;
  cost_bps?: number; // one-way cost in basis points
}

interface ScoresRow {
  ticker: string;
  as_of: string;
  final_score: number | null;
}
interface PriceRow {
  ticker: string;
  date: string;
  close: number | null;
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
    const end = body.end ?? new Date().toISOString().slice(0, 10);
    const start = body.start ?? isoDateMinusDays(end, 5 * 365);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      throw new HttpError(400, "start / end must be YYYY-MM-DD");
    }
    const topN = body.top_n ?? 10;
    const costPerSide = (body.cost_bps ?? 10) / 10000;

    const client = serviceClient();

    // Pull all scores_history rows in the window.
    const shRes = await client
      .from("scores_history")
      .select("ticker, as_of, final_score")
      .gte("as_of", start)
      .lte("as_of", end)
      .order("as_of");
    if (shRes.error) throw shRes.error;
    const scores: ScoreObs[] = ((shRes.data ?? []) as ScoresRow[]).map((r) => ({
      ticker: r.ticker,
      as_of: r.as_of,
      score: r.final_score,
    }));

    // Pull month-end closes (we approximate by taking the last close
    // in each calendar month per ticker).
    const tickers = Array.from(new Set(scores.map((s) => s.ticker)));
    if (tickers.length === 0) {
      return Response.json({
        ok: true,
        elapsed_ms: Date.now() - startedAt,
        note: "No scores_history rows in window — backtest cannot run.",
      });
    }
    const priceRes = await client
      .from("prices_raw")
      .select("ticker, date, close")
      .gte("date", start)
      .lte("date", end)
      .in("ticker", tickers)
      .order("ticker")
      .order("date", { ascending: true });
    if (priceRes.error) throw priceRes.error;
    const rebalanceDates = monthEndDates(start, end);
    const closeByTickerMonth = lastCloseEachMonth((priceRes.data ?? []) as PriceRow[]);

    const returns: ReturnObs[] = [];
    for (const t of tickers) {
      const series = closeByTickerMonth.get(t) ?? new Map<string, number>();
      let prev: number | null = null;
      for (const d of rebalanceDates) {
        const c = series.get(d);
        if (c != null && Number.isFinite(c)) {
          if (prev != null && prev > 0) {
            returns.push({ as_of: d, ticker: t, ret: (c - prev) / prev });
          }
          prev = c;
        }
      }
    }

    const result = runBacktest(scores, returns, {
      rebalanceDates,
      topN,
      costPerSide,
    });

    return Response.json({
      ok: true,
      start,
      end,
      config: { top_n: topN, cost_bps: (body.cost_bps ?? 10) },
      summary: {
        total_return: result.total_return,
        sharpe: result.sharpe,
        max_drawdown: result.max_drawdown,
        hit_rate: result.hit_rate,
        avg_turnover: result.avg_turnover,
        rebalance_count: result.rebalance_count,
      },
      series: {
        monthly_returns_net: result.monthly_returns_net,
        turnover: result.turnover_series,
      },
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});

function isoDateMinusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function monthEndDates(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  while (true) {
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
    if (lastDay > endIso) break;
    if (lastDay >= startIso) out.push(lastDay);
    m++;
    if (m > 11) { m = 0; y++; }
    if (y > end.getUTCFullYear() + 1) break;
  }
  return out;
}

function lastCloseEachMonth(rows: PriceRow[]): Map<string, Map<string, number>> {
  // Map<ticker, Map<month-end ISO, close>>
  const byTicker = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.close == null) continue;
    const monthEnd = lastDayOfMonth(r.date);
    const inner = byTicker.get(r.ticker) ?? new Map<string, number>();
    // Always take the latest (later overrides earlier within the same month).
    inner.set(monthEnd, Number(r.close));
    byTicker.set(r.ticker, inner);
  }
  return byTicker;
}

function lastDayOfMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

// THS-49 — Daily macro gauges ingestion.
//
// Pulls NAAIM (weekly Wednesday reading, page scrape) and CNN Fear & Greed
// (daily JSON endpoint) live. AAII 3-week bull-bear spread is operator-
// curated in v1 — AAII's public sentiment page is behind Imperva bot
// protection and cannot be fetched headlessly. AAII forward-fills from the
// previous macro_gauges row each day; the operator overrides on Thursdays
// either via SQL/Studio or by invoking this function with an
// `{aaii_3wk_spread: <number>}` POST body.
//
// Modes:
//   - daily (default): builds one row for today and upserts.
//   - backfill: `?backfill_days=N` walks N calendar days back (max 400),
//     building one row per date using at-or-before semantics on the feeds.
//     Useful for first-run population of the 12-month history per THS-49
//     acceptance. AAII rows are filled from the previous-row forward-fill
//     chain; operator backfills historical AAII manually if needed.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { fetchFearGreed, fetchNaaim } from "../_shared/macro-fetchers.ts";
import {
  buildMacroRow,
  pickAtOrBefore,
  type AaiiWeekly,
  type FearGreedRow,
  type MacroRow,
  type NaaimRow,
} from "../_shared/macro.ts";
import { serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BACKFILL_DAYS = 400;

interface RequestBody {
  aaii_3wk_spread?: number;
  aaii_weekly?: AaiiWeekly[];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoMinusDays(asOf: string, days: number): string {
  const d = new Date(asOf + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function parseBody(req: Request): Promise<RequestBody> {
  if (req.method !== "POST") return {};
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as RequestBody;
  } catch {
    return {};
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = Date.now();
  try {
    requireCronAuth(req);
    const url = new URL(req.url);
    const backfillDays = Math.max(
      0,
      Math.min(MAX_BACKFILL_DAYS, Number(url.searchParams.get("backfill_days") ?? 0)),
    );
    const today = todayISO();
    const body = await parseBody(req);

    // Fetch both live feeds in parallel; one failing shouldn't drop the other.
    const [naaimRes, fngRes] = await Promise.allSettled([fetchNaaim(), fetchFearGreed()]);
    const naaim: NaaimRow[] = naaimRes.status === "fulfilled" ? naaimRes.value : [];
    const fearGreed: FearGreedRow[] = fngRes.status === "fulfilled" ? fngRes.value : [];
    const fetchErrors: Record<string, string> = {};
    if (naaimRes.status === "rejected") {
      fetchErrors.naaim = naaimRes.reason instanceof Error ? naaimRes.reason.message : String(naaimRes.reason);
    }
    if (fngRes.status === "rejected") {
      fetchErrors.fear_greed = fngRes.reason instanceof Error ? fngRes.reason.message : String(fngRes.reason);
    }

    const client = serviceClient();

    // Build the list of dates to ingest. Backfill walks chronologically so
    // each row's forward-fill sees the previous row we just wrote.
    const dates: string[] = [];
    for (let i = backfillDays; i >= 0; i--) dates.push(isoMinusDays(today, i));

    // Load the latest existing macro_gauges row whose as_of < earliest date
    // we're about to write — that's the seed for the forward-fill chain.
    const earliest = dates[0];
    const seedRes = await client
      .from("macro_gauges")
      .select("as_of, naaim, aaii_3wk_spread, fear_greed, source_notes")
      .lt("as_of", earliest)
      .order("as_of", { ascending: false })
      .limit(1);
    if (seedRes.error) throw seedRes.error;
    let prev: MacroRow | null = (seedRes.data ?? [])[0] as MacroRow | null;

    // AAII weekly observations available for the run: optionally provided in
    // POST body. Empty in v1 cron path → 3-wk MA stays null and forward-fill
    // preserves the most recent operator-curated value.
    const aaiiWeekly: AaiiWeekly[] = Array.isArray(body.aaii_weekly) ? body.aaii_weekly : [];

    // Optional one-shot override for today's row (operator's Thursday flow).
    const aaiiOverride =
      typeof body.aaii_3wk_spread === "number" && Number.isFinite(body.aaii_3wk_spread)
        ? body.aaii_3wk_spread
        : null;

    let upserted = 0;
    const failures: Array<{ as_of: string; error: string }> = [];

    for (const asOf of dates) {
      try {
        const row = buildMacroRow({
          asOf,
          naaim,
          fearGreed,
          aaiiWeekly,
          previousRow: prev,
          sourceNotes:
            backfillDays > 0
              ? "backfill (NAAIM/F&G live, AAII forward-filled)"
              : "daily ingest (NAAIM/F&G live, AAII forward-filled)",
        });
        // Apply Thursday-flow override if this is today's row.
        if (asOf === today && aaiiOverride !== null) {
          row.aaii_3wk_spread = aaiiOverride;
          row.source_notes = `${row.source_notes ?? ""} | AAII override`.trim();
        }
        // Also pick up any same-date row in the supplied aaiiWeekly that the
        // 3-wk-MA path may have skipped (e.g., when only 1-2 weekly obs exist).
        const sameWeek = pickAtOrBefore(aaiiWeekly, asOf);
        if (
          asOf === today &&
          row.aaii_3wk_spread === null &&
          sameWeek !== null &&
          Number.isFinite(sameWeek.spread)
        ) {
          row.aaii_3wk_spread = sameWeek.spread;
        }

        const { error } = await client
          .from("macro_gauges")
          .upsert(row, { onConflict: "as_of" });
        if (error) throw error;
        upserted += 1;
        prev = row;
      } catch (e) {
        failures.push({ as_of: asOf, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const ok = failures.length === 0 && Object.keys(fetchErrors).length === 0;
    return Response.json(
      {
        ok,
        mode: backfillDays > 0 ? "backfill" : "daily",
        today,
        backfill_days: backfillDays,
        upserted,
        feeds: {
          naaim_rows: naaim.length,
          fear_greed_points: fearGreed.length,
          aaii_weekly_provided: aaiiWeekly.length,
          aaii_override: aaiiOverride,
        },
        fetch_errors: fetchErrors,
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

/**
 * Server-only loader for /settings — read-only operator view.
 *
 * Surfaces three things:
 *   1. Account: signed-in email (passed by the page; auth already resolved in layout).
 *   2. Cron registry: static list mirroring the migrations under
 *      supabase/migrations/*_cron.sql. We don't query pg_cron.job directly —
 *      that table is owned by postgres and the anon role can't read it under
 *      RLS, so we keep a hand-maintained registry instead. Keep in sync.
 *   3. Freshness: MAX(timestamp) per data table. Stale checks help operators
 *      catch a silently-broken cron without opening Supabase logs.
 *
 * Returns nulls instead of throwing when Supabase env is unset.
 */
import { getSupabaseServer } from "./supabase/server";

export interface CronJob {
  jobname: string;
  schedule: string;        // cron string (UTC)
  cadence: string;         // human-readable
  fn: string;              // edge function name
  notes?: string;
}

export const CRON_REGISTRY: CronJob[] = [
  // Daily ingestion (weekday 21:00–22:00 UTC band)
  { jobname: "ingest-fundamentals-daily", schedule: "0 21 * * 1-5", cadence: "Mon–Fri 21:00 UTC", fn: "ingest-fundamentals" },
  { jobname: "ingest-consensus-daily",    schedule: "10 21 * * 1-5", cadence: "Mon–Fri 21:10 UTC", fn: "ingest-consensus" },
  { jobname: "ingest-prices-daily",       schedule: "20 21 * * 1-5", cadence: "Mon–Fri 21:20 UTC", fn: "ingest-prices" },
  { jobname: "ingest-macro-daily",        schedule: "30 21 * * *",   cadence: "Daily 21:30 UTC",   fn: "ingest-macro" },
  { jobname: "ingest-options-daily",      schedule: "0 22 * * 1-5",  cadence: "Mon–Fri 22:00 UTC", fn: "ingest-options" },
  { jobname: "ingest-form4-daily",        schedule: "50 22 * * 1-5", cadence: "Mon–Fri 22:50 UTC", fn: "ingest-form4" },
  { jobname: "ingest-short-interest-bimonthly", schedule: "0 23 9,24 * *", cadence: "9th + 24th of month 23:00 UTC", fn: "ingest-short-interest" },

  // Saturday scoring chain — Q → G → V → M → S → composite → concentration
  { jobname: "compute-q-scores-weekly",         schedule: "0 22 * * 6",  cadence: "Saturday 22:00 UTC", fn: "compute-q-scores" },
  { jobname: "compute-g-scores-weekly",         schedule: "10 22 * * 6", cadence: "Saturday 22:10 UTC", fn: "compute-g-scores" },
  { jobname: "compute-v-scores-weekly",         schedule: "20 22 * * 6", cadence: "Saturday 22:20 UTC", fn: "compute-v-scores" },
  { jobname: "compute-m-scores-weekly",         schedule: "30 22 * * 6", cadence: "Saturday 22:30 UTC", fn: "compute-m-scores" },
  { jobname: "compute-s-scores-weekly",         schedule: "35 22 * * 6", cadence: "Saturday 22:35 UTC", fn: "compute-s-scores" },
  { jobname: "compute-composite-scores-weekly", schedule: "45 22 * * 6", cadence: "Saturday 22:45 UTC", fn: "compute-composite-scores" },
  { jobname: "compute-concentration-weekly",    schedule: "55 22 * * 6", cadence: "Saturday 22:55 UTC", fn: "compute-concentration" },

  // Memos + quarterly
  { jobname: "compute-daily-memo",      schedule: "0 13 * * *", cadence: "Daily 13:00 UTC",  fn: "compute-daily-memo" },
  { jobname: "compute-weekly-ranking",  schedule: "0 23 * * 0", cadence: "Sunday 23:00 UTC", fn: "compute-weekly-ranking" },
  { jobname: "compute-quarterly-review", schedule: "0 0 1 1,4,7,10 *", cadence: "Quarterly", fn: "compute-quarterly-review", notes: "1st of Jan/Apr/Jul/Oct, 00:00 UTC" },
];

export interface FreshnessRow {
  label: string;       // human-readable surface name
  table: string;       // supabase table
  column: string;      // timestamp column queried
  latest: string | null;
  staleHours: number | null;
  expectedHours: number; // SLA: alert if older than this
}

export interface SettingsSnapshot {
  envConfigured: boolean;
  cron: CronJob[];
  freshness: FreshnessRow[];
}

interface FreshnessProbe {
  label: string;
  table: string;
  column: string;
  expectedHours: number;
}

const PROBES: FreshnessProbe[] = [
  { label: "Fundamentals",       table: "fundamentals_raw",      column: "ingested_at",     expectedHours: 30 },
  { label: "Consensus",          table: "consensus",             column: "as_of",           expectedHours: 30 },
  { label: "Prices",             table: "prices_raw",            column: "date",            expectedHours: 30 },
  { label: "Macro gauges",       table: "macro_gauges",          column: "as_of",           expectedHours: 30 },
  { label: "Options",            table: "options_raw",           column: "as_of",           expectedHours: 30 },
  { label: "Insider Form 4",     table: "insider_form4_raw",     column: "filing_date",     expectedHours: 30 },
  { label: "Short interest",     table: "short_interest_raw",    column: "settlement_date", expectedHours: 400 }, // bimonthly (~15 day cycle + 1 wk buffer)
  { label: "Composite scores",   table: "scores_history",        column: "as_of",           expectedHours: 200 }, // weekly Sat
  { label: "Concentration tax",  table: "concentration_history", column: "as_of",           expectedHours: 200 },
  { label: "Daily memo",         table: "memos",                 column: "generated_at",    expectedHours: 30 },
  { label: "AIQ drafts",         table: "aiq_drafts",            column: "generated_at",    expectedHours: 720 }, // manual cadence
];

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) {
    return {
      envConfigured: false,
      cron: CRON_REGISTRY,
      freshness: PROBES.map((p) => ({
        label: p.label,
        table: p.table,
        column: p.column,
        latest: null,
        staleHours: null,
        expectedHours: p.expectedHours,
      })),
    };
  }

  const now = Date.now();
  const freshness: FreshnessRow[] = await Promise.all(
    PROBES.map(async (p) => {
      const { data, error } = await sb
        .from(p.table)
        .select(p.column)
        .order(p.column, { ascending: false })
        .limit(1);
      if (error || !data || data.length === 0) {
        return { label: p.label, table: p.table, column: p.column, latest: null, staleHours: null, expectedHours: p.expectedHours };
      }
      const raw = (data[0] as unknown as Record<string, unknown>)[p.column];
      const latest = raw == null ? null : String(raw);
      const staleHours =
        latest == null ? null : Math.max(0, (now - new Date(latest).getTime()) / (1000 * 60 * 60));
      return { label: p.label, table: p.table, column: p.column, latest, staleHours, expectedHours: p.expectedHours };
    }),
  );

  return { envConfigured: true, cron: CRON_REGISTRY, freshness };
}

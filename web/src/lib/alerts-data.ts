/**
 * Server-only alerts derivation for /decisions (THS-57).
 *
 * Alerts are DERIVED on read from `scores_history` + `macro_gauges`.
 * Persistence is only of acknowledgements (alert_acks). Event identity
 * is encoded into alert_key so acks survive recomputation.
 *
 * Event types:
 *   - tier_change: row.tier != prior.tier (per ticker)
 *   - conv_drop:   prior was High and (row.final_score - prior.final_score) ≤ -10
 *   - aiq_drift:   |row.aiq_score - prior.aiq_score| > 10
 *   - macro_flip:  count of gauges crossing thresholds changed week-over-week
 *   - insider_cluster: stub — THS-58 pending (no Form 4 data yet)
 *
 * Fixture: when env unset OR scores_history empty, synthesizes a handful
 * of canonical events keyed to fixture universe tickers so the page
 * still renders meaningfully in dev.
 */
import { getSupabaseServer } from "./supabase/server";
import { FIXTURE_INDEX } from "./universe-fixture";
import {
  ALERT_KIND_LABELS,
  AIQ_DRIFT_THRESHOLD,
  CONV_DROP_THRESHOLD,
  alertKey,
  type AlertEvent,
} from "./alerts-types";

interface ScoresRow {
  ticker: string;
  as_of: string;
  composite: number | null;
  final_score: number | null;
  aiq_score: number | null;
  tier: string | null;
}

interface MacroRow {
  as_of: string;
  naaim: number | null;
  aaii_3wk_spread: number | null;
  fear_greed: number | null;
}

interface AckRow {
  alert_key: string;
  acked_at: string;
  acked_note: string | null;
}

export interface AlertsSnapshot {
  events: AlertEvent[];
  unseen: number;
  envConfigured: boolean;
  synthetic: boolean;
}

export async function getAlertsSnapshot(): Promise<AlertsSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) return synthesize(false);

  const [scoresRes, macroRes, acksRes] = await Promise.all([
    sb
      .from("scores_history")
      .select("ticker,as_of,composite,final_score,aiq_score,tier")
      .order("ticker", { ascending: true })
      .order("as_of", { ascending: true })
      .limit(2000),
    sb
      .from("macro_gauges")
      .select("as_of,naaim,aaii_3wk_spread,fear_greed")
      .order("as_of", { ascending: true })
      .limit(120),
    sb.from("alert_acks").select("alert_key,acked_at,acked_note"),
  ]);

  const scores = (scoresRes.data ?? []) as ScoresRow[];
  const macro = (macroRes.data ?? []) as MacroRow[];
  const acks = new Map<string, AckRow>(
    ((acksRes.data ?? []) as AckRow[]).map((a) => [a.alert_key, a]),
  );

  if (scores.length === 0 && macro.length === 0) return synthesize(true);

  const events = deriveEvents(scores, macro);
  hydrateAcks(events, acks);

  events.sort((a, b) => (a.as_of < b.as_of ? 1 : a.as_of > b.as_of ? -1 : 0));
  return {
    events,
    unseen: events.filter((e) => !e.acked_at).length,
    envConfigured: true,
    synthetic: false,
  };
}

export async function getUnseenAlertCount(): Promise<number> {
  const snap = await getAlertsSnapshot();
  return snap.unseen;
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

function deriveEvents(scores: ScoresRow[], macro: MacroRow[]): AlertEvent[] {
  const out: AlertEvent[] = [];

  // Group scores by ticker (rows already ordered as_of ascending per ticker).
  const byTicker = new Map<string, ScoresRow[]>();
  for (const r of scores) {
    const arr = byTicker.get(r.ticker);
    if (arr) arr.push(r);
    else byTicker.set(r.ticker, [r]);
  }

  for (const [ticker, rows] of byTicker) {
    for (let i = 1; i < rows.length; i++) {
      const prior = rows[i - 1];
      const row = rows[i];

      // Tier change
      if (prior.tier && row.tier && prior.tier !== row.tier) {
        out.push({
          key: alertKey("tier_change", ticker, row.as_of),
          kind: "tier_change",
          ticker,
          as_of: row.as_of,
          prior_as_of: prior.as_of,
          title: `${ticker} tier ${prior.tier} → ${row.tier}`,
          detail: `Tier moved ${prior.tier} → ${row.tier} between ${prior.as_of} and ${row.as_of}. Final score ${fmt(prior.final_score)} → ${fmt(row.final_score)}.`,
          severity: severityForTier(prior.tier, row.tier),
          acked_at: null,
          acked_note: null,
        });
      }

      // High-conviction drop ≥ 10pt
      if (
        prior.tier === "High" &&
        prior.final_score != null &&
        row.final_score != null &&
        row.final_score - prior.final_score <= -CONV_DROP_THRESHOLD
      ) {
        const delta = row.final_score - prior.final_score;
        out.push({
          key: alertKey("conv_drop", ticker, row.as_of),
          kind: "conv_drop",
          ticker,
          as_of: row.as_of,
          prior_as_of: prior.as_of,
          title: `${ticker} ${delta.toFixed(1)}pt drop from High`,
          detail: `${ticker} was High at ${prior.as_of} with final ${fmt(prior.final_score)}; ${row.as_of} final ${fmt(row.final_score)} (Δ ${delta.toFixed(1)}).`,
          severity: "high",
          acked_at: null,
          acked_note: null,
        });
      }

      // AIQ drift > 10
      if (
        prior.aiq_score != null &&
        row.aiq_score != null &&
        Math.abs(row.aiq_score - prior.aiq_score) > AIQ_DRIFT_THRESHOLD
      ) {
        const delta = row.aiq_score - prior.aiq_score;
        out.push({
          key: alertKey("aiq_drift", ticker, row.as_of),
          kind: "aiq_drift",
          ticker,
          as_of: row.as_of,
          prior_as_of: prior.as_of,
          title: `${ticker} AIQ ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`,
          detail: `${ticker} AIQ moved ${fmt(prior.aiq_score)} → ${fmt(row.aiq_score)} (Δ ${delta.toFixed(1)}) between ${prior.as_of} and ${row.as_of}.`,
          severity: "warn",
          acked_at: null,
          acked_note: null,
        });
      }
    }
  }

  // Macro gate flips — week-over-week change in count of fired gates.
  for (let i = 1; i < macro.length; i++) {
    const prior = macro[i - 1];
    const row = macro[i];
    const priorGates = countGates(prior);
    const rowGates = countGates(row);
    if (priorGates !== rowGates) {
      out.push({
        key: alertKey("macro_flip", null, row.as_of),
        kind: "macro_flip",
        ticker: null,
        as_of: row.as_of,
        prior_as_of: prior.as_of,
        title: `Macro gates ${priorGates} → ${rowGates}`,
        detail: `Gates fired changed ${priorGates} → ${rowGates}. NAAIM ${fmt(row.naaim)}, AAII ${fmt(row.aaii_3wk_spread)}, F&G ${fmt(row.fear_greed)}.`,
        severity: rowGates > priorGates ? "high" : "info",
        acked_at: null,
        acked_note: null,
      });
    }
  }

  return out;
}

function countGates(g: MacroRow): number {
  let n = 0;
  if (g.naaim != null && g.naaim > 90) n++;
  if (g.aaii_3wk_spread != null && g.aaii_3wk_spread > 30) n++;
  if (g.fear_greed != null && g.fear_greed > 80) n++;
  return n;
}

const TIER_ORDER: Record<string, number> = { High: 3, Medium: 2, Low: 1, Avoid: 0 };
function severityForTier(from: string, to: string): AlertEvent["severity"] {
  const a = TIER_ORDER[from] ?? 2;
  const b = TIER_ORDER[to] ?? 2;
  if (b < a) return "high"; // downgrade
  if (b > a) return "info"; // upgrade
  return "warn";
}

function hydrateAcks(events: AlertEvent[], acks: Map<string, AckRow>) {
  for (const e of events) {
    const a = acks.get(e.key);
    if (a) {
      e.acked_at = a.acked_at;
      e.acked_note = a.acked_note;
    }
  }
}

function fmt(n: number | null): string {
  return n == null ? "—" : n.toFixed(1);
}

// ---------------------------------------------------------------------------
// Fixture — deterministic canonical events so /decisions renders without env.
// ---------------------------------------------------------------------------

function synthesize(envConfigured: boolean): AlertsSnapshot {
  const sample = (t: string) => FIXTURE_INDEX[t]?.ticker ?? t;
  const events: AlertEvent[] = [
    {
      key: alertKey("tier_change", "AVGO", "2026-04-12"),
      kind: "tier_change",
      ticker: sample("AVGO"),
      as_of: "2026-04-12",
      prior_as_of: "2026-04-05",
      title: "AVGO tier High → Medium",
      detail: "Tier moved High → Medium between 2026-04-05 and 2026-04-12. Final score 78.0 → 74.1 (one-tier shift on 0.95× macro gate retained).",
      severity: "high",
      acked_at: null,
      acked_note: null,
    },
    {
      key: alertKey("conv_drop", "PLTR", "2026-05-09"),
      kind: "conv_drop",
      ticker: "PLTR",
      as_of: "2026-05-09",
      prior_as_of: "2026-05-02",
      title: "PLTR -11.2pt drop from High",
      detail: "PLTR was High at 2026-05-02 with final 75.6; 2026-05-09 final 64.4 (Δ -11.2). Burry put renewals reported in 13F.",
      severity: "high",
      acked_at: null,
      acked_note: null,
    },
    {
      key: alertKey("aiq_drift", "META", "2026-04-30"),
      kind: "aiq_drift",
      ticker: "META",
      as_of: "2026-04-30",
      prior_as_of: "2026-01-30",
      title: "META AIQ -12.0",
      detail: "META AIQ moved 66.0 → 54.0 (Δ -12.0) between 2026-01-30 and 2026-04-30 after server-life extension disclosure.",
      severity: "warn",
      acked_at: null,
      acked_note: null,
    },
    {
      key: alertKey("macro_flip", null, "2026-05-14"),
      kind: "macro_flip",
      ticker: null,
      as_of: "2026-05-14",
      prior_as_of: "2026-05-07",
      title: "Macro gates 0 → 1",
      detail: "Gates fired changed 0 → 1. NAAIM 96.7 crossed > 90 threshold this week. Multiplier 1.00 → 0.95.",
      severity: "high",
      acked_at: null,
      acked_note: null,
    },
  ];
  return {
    events,
    unseen: events.length,
    envConfigured,
    synthetic: true,
  };
}

export { ALERT_KIND_LABELS };

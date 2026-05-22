/**
 * Server-side fetcher for /regime (THS-56).
 *
 * Pulls the last 52 weeks of `macro_gauges` rows (anon SELECT allowed, no
 * auth gate needed). Computes:
 *   - Current readings (most recent row)
 *   - Gate count + active multiplier (mirrors composite.ts countMacroGates)
 *   - Per-gauge threshold-crossing history (count + most recent as_of)
 *
 * When env unset or the table is empty, returns an empty snapshot — the
 * page renders empty state until the daily-batch routine writes rows.
 */
import { getSupabaseServer } from "./supabase/server";
import {
  GAUGES,
  MULTIPLIER_BY_GATES,
  type GateChange,
  type GaugeKey,
  type MacroGaugeRow,
  type RegimeSnapshot,
  type ThresholdHistory,
} from "./regime-types";

export async function getRegimeSnapshot(): Promise<RegimeSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) return finalize([], false, false);

  // 52 weekly rows ≈ 52 calendar rows. Pull a bit more in case of irregular
  // cadence; UI clamps to the most recent 52 on render.
  //
  // Order DESC + reverse: previously this was `ascending: true` with
  // `.limit(60)`, which returns the OLDEST 60 rows. Once the daily cron
  // pushed the table past 60 rows, the page was rendering ~2 months of
  // prehistoric data and `latest` was the snapshot from 60 days after
  // table birth, not the actual latest. Fetch newest 60 first, then
  // reverse to ascending so the rest of the pipeline (slice(-52), latest
  // = history[length-1], gate-change walk) stays correct. Caught 2026-05-19
  // when the live page rendered 2025-07-16 instead of 2026-05-18.
  const { data } = await sb
    .from("macro_gauges")
    .select("as_of,naaim,aaii_3wk_spread,fear_greed")
    .order("as_of", { ascending: false })
    .limit(60);

  const rows = ((data ?? []) as MacroGaugeRow[]).reverse();
  return finalize(rows, true, false);
}

function finalize(rows: MacroGaugeRow[], envConfigured: boolean, synthetic: boolean): RegimeSnapshot {
  const history = rows.slice(-52);
  const latest = history[history.length - 1] ?? null;

  let gates_hit = 0;
  if (latest) {
    if (latest.naaim != null && latest.naaim > 90) gates_hit += 1;
    if (latest.aaii_3wk_spread != null && latest.aaii_3wk_spread > 30) gates_hit += 1;
    if (latest.fear_greed != null && latest.fear_greed > 80) gates_hit += 1;
  }
  const multiplier = MULTIPLIER_BY_GATES[Math.min(3, gates_hit) as 0 | 1 | 2 | 3] ?? 1;

  const threshold_history: Record<GaugeKey, ThresholdHistory> = {
    naaim: scanThreshold(history, "naaim"),
    aaii_3wk_spread: scanThreshold(history, "aaii_3wk_spread"),
    fear_greed: scanThreshold(history, "fear_greed"),
  };

  return {
    history,
    latest,
    gates_hit,
    multiplier,
    threshold_history,
    gate_changes: computeGateChanges(history),
    synthetic,
    envConfigured,
  };
}

/**
 * Walk the 52w history and emit one GateChange per week where the gate count
 * differs from the prior week. Most-recent first, capped at 8 entries (UI
 * shows 5; tail kept for footer tooltips).
 */
function computeGateChanges(history: MacroGaugeRow[]): GateChange[] {
  const out: GateChange[] = [];
  if (history.length < 2) return out;
  let prior = countGates(history[0]);
  let priorState = gateState(history[0]);
  for (let i = 1; i < history.length; i++) {
    const row = history[i];
    const current = countGates(row);
    const currentState = gateState(row);
    if (current !== prior) {
      // Identify cause: first gauge whose hit-state flipped this row.
      let cause: GaugeKey = "naaim";
      let causeLabel = "";
      for (const g of GAUGES) {
        if (currentState[g.key] !== priorState[g.key]) {
          cause = g.key;
          const v = row[g.key];
          const direction = currentState[g.key] ? `crossed ${g.threshold}` : `dropped below ${g.threshold}`;
          const reading = v != null ? ` (${fmtReading(v, g.key)})` : "";
          causeLabel = `${shortLabel(g.key)} ${direction}${reading}`;
          break;
        }
      }
      out.push({
        as_of: row.as_of,
        cause,
        cause_label: causeLabel,
        prior_gates: prior,
        current_gates: current,
        prior_multiplier: MULTIPLIER_BY_GATES[Math.min(3, prior) as 0 | 1 | 2 | 3] ?? 1,
        current_multiplier: MULTIPLIER_BY_GATES[Math.min(3, current) as 0 | 1 | 2 | 3] ?? 1,
      });
    }
    prior = current;
    priorState = currentState;
  }
  return out.reverse().slice(0, 8);
}

function countGates(r: MacroGaugeRow): number {
  let c = 0;
  if (r.naaim != null && r.naaim > 90) c += 1;
  if (r.aaii_3wk_spread != null && r.aaii_3wk_spread > 30) c += 1;
  if (r.fear_greed != null && r.fear_greed > 80) c += 1;
  return c;
}

function gateState(r: MacroGaugeRow): Record<GaugeKey, boolean> {
  return {
    naaim: r.naaim != null && r.naaim > 90,
    aaii_3wk_spread: r.aaii_3wk_spread != null && r.aaii_3wk_spread > 30,
    fear_greed: r.fear_greed != null && r.fear_greed > 80,
  };
}

function shortLabel(key: GaugeKey): string {
  return key === "naaim" ? "NAAIM" : key === "aaii_3wk_spread" ? "AAII spread" : "F&G";
}

function fmtReading(n: number, key: GaugeKey): string {
  if (key === "naaim") return n.toFixed(1);
  if (key === "aaii_3wk_spread") return (n > 0 ? "+" : "") + n.toFixed(1);
  return n.toFixed(0);
}

function scanThreshold(history: MacroGaugeRow[], key: GaugeKey): ThresholdHistory {
  const meta = GAUGES.find((g) => g.key === key);
  if (!meta) return { hits: 0, last_hit_at: null };
  let hits = 0;
  let last: string | null = null;
  for (const r of history) {
    const v = r[key];
    if (v != null && v > meta.threshold) {
      hits += 1;
      last = r.as_of;
    }
  }
  return { hits, last_hit_at: last };
}


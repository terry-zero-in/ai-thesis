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
 *   - insider_cluster: BUY/SELL cluster newly fired this week vs prior (THS-61
 *                      `detectClusterOverride` semantics — replicated here so
 *                      web doesn't import from the Deno-targeted edge module)
 */
import { getSupabaseServer } from "./supabase/server";
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

interface Form4Row {
  ticker: string;
  transaction_date: string;
  insider_name: string;
  transaction_code: string;
  shares: number | null;
  price_per_share: number | null;
  transaction_value: number | null;
  is_10b5_1: boolean | null;
}

interface QuarterlyReviewRow {
  as_of: string;
  findings: Array<{
    check_id: string;
    severity: "info" | "warn" | "high" | "data_gap";
    summary: string;
    detail: string;
  }>;
  generated_at: string;
  reviewed_at: string | null;
  reviewed_note: string | null;
}

interface PositionPulseRow {
  ticker: string;
  as_of: string;
  verdict: "intact" | "weakening" | "broken";
  reasoning: string;
  score_delta: number | null;
  insider_signal: string | null;
  created_at: string;
}

export interface AlertsSnapshot {
  events: AlertEvent[];
  unseen: number;
  envConfigured: boolean;
  synthetic: boolean;
}

export async function getAlertsSnapshot(): Promise<AlertsSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) return emptySnapshot(false);

  const insiderFromIso = isoDateMinusDays(new Date().toISOString().slice(0, 10), INSIDER_LOOKBACK_DAYS);

  const [scoresRes, macroRes, acksRes, qrRes, insiderRes, pulseRes] = await Promise.all([
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
    sb
      .from("quarterly_reviews")
      .select("as_of,findings,generated_at,reviewed_at,reviewed_note")
      .order("as_of", { ascending: false })
      .limit(4),
    sb
      .from("insider_form4_raw")
      .select(
        "ticker,transaction_date,insider_name,transaction_code,shares,price_per_share,transaction_value,is_10b5_1",
      )
      .gte("transaction_date", insiderFromIso)
      .in("transaction_code", ["P", "S"])
      .order("ticker", { ascending: true })
      .order("transaction_date", { ascending: false })
      .limit(5000),
    // position_pulse — RLS scopes to caller's auth.uid(); no manual user
    // filter needed. We only surface broken verdicts as alerts; intact /
    // weakening render elsewhere (portfolio rows, dashboard).
    sb
      .from("position_pulse")
      .select("ticker,as_of,verdict,reasoning,score_delta,insider_signal,created_at")
      .eq("verdict", "broken")
      .order("as_of", { ascending: false })
      .limit(200),
  ]);

  const scores = (scoresRes.data ?? []) as ScoresRow[];
  const macro = (macroRes.data ?? []) as MacroRow[];
  const acks = new Map<string, AckRow>(
    ((acksRes.data ?? []) as AckRow[]).map((a) => [a.alert_key, a]),
  );
  const quarterly = (qrRes.data ?? []) as QuarterlyReviewRow[];
  const insider = (insiderRes.data ?? []) as Form4Row[];
  const pulses = (pulseRes.data ?? []) as PositionPulseRow[];

  if (
    scores.length === 0 &&
    macro.length === 0 &&
    quarterly.length === 0 &&
    insider.length === 0 &&
    pulses.length === 0
  ) {
    return emptySnapshot(true);
  }

  const events = deriveEvents(scores, macro);
  for (const qr of quarterly) events.push(quarterlyEvent(qr));
  for (const e of deriveInsiderClusters(insider)) events.push(e);
  for (const p of pulses) events.push(thesisBrokenEvent(p));
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

// ---------------------------------------------------------------------------
// Insider cluster events (THS-61 helper, replicated here for the web side).
//
// Walk 4 weekly as-of snapshots over the last ~30 days. For each ticker,
// detect cluster state at each snapshot. Emit an event when the cluster
// newly emerges (prior week: none → this week: BUY/SELL) so the alert log
// shows "fired this week" rather than every active cluster every week.
// ---------------------------------------------------------------------------

const INSIDER_LOOKBACK_DAYS = 140;
const INSIDER_WEEK_SNAPSHOTS = 4;

// Mirrors supabase/functions/_shared/factor-insider.ts spec constants.
const BUY_INSIDER_MIN = 3;
const BUY_VALUE_MIN = 1_000_000;
const BUY_WINDOW_DAYS = 90;
const SELL_INSIDER_MIN = 3;
const SELL_VALUE_MIN = 5_000_000;
const SELL_WINDOW_DAYS = 60;

type ClusterKind = "BUY" | "SELL" | null;
interface ClusterState {
  kind: ClusterKind;
  insiders: number;
  total_value: number;
  window_start: string;
}

function deriveInsiderClusters(rows: Form4Row[]): AlertEvent[] {
  if (rows.length === 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  const snapshotDates: string[] = [];
  for (let i = 0; i < INSIDER_WEEK_SNAPSHOTS; i++) {
    snapshotDates.push(isoDateMinusDays(today, i * 7));
  }
  snapshotDates.reverse(); // oldest → newest

  const byTicker = new Map<string, Form4Row[]>();
  for (const r of rows) {
    const arr = byTicker.get(r.ticker) ?? [];
    arr.push(r);
    byTicker.set(r.ticker, arr);
  }

  const events: AlertEvent[] = [];
  for (const [ticker, filings] of byTicker) {
    let prior: ClusterState = { kind: null, insiders: 0, total_value: 0, window_start: "" };
    for (const asOf of snapshotDates) {
      const state = detectClusterAt(filings, asOf);
      if (state.kind !== null && state.kind !== prior.kind) {
        events.push(insiderClusterEvent(ticker, asOf, state));
      }
      prior = state;
    }
  }
  return events;
}

function detectClusterAt(filings: ReadonlyArray<Form4Row>, asOf: string): ClusterState {
  const buyCutoff = isoDateMinusDays(asOf, BUY_WINDOW_DAYS);
  const sellCutoff = isoDateMinusDays(asOf, SELL_WINDOW_DAYS);

  const buys = filings.filter(
    (f) => f.transaction_code === "P" && f.transaction_date >= buyCutoff && f.transaction_date <= asOf,
  );
  const buyAgg = aggregateByInsider(buys, BUY_VALUE_MIN);
  if (buyAgg.insiders >= BUY_INSIDER_MIN) {
    return { kind: "BUY", insiders: buyAgg.insiders, total_value: buyAgg.total_value, window_start: buyCutoff };
  }

  const sells = filings.filter(
    (f) =>
      f.transaction_code === "S" &&
      f.is_10b5_1 !== true &&
      f.transaction_date >= sellCutoff &&
      f.transaction_date <= asOf,
  );
  const sellAgg = aggregateByInsider(sells, SELL_VALUE_MIN);
  if (sellAgg.insiders >= SELL_INSIDER_MIN) {
    return { kind: "SELL", insiders: sellAgg.insiders, total_value: sellAgg.total_value, window_start: sellCutoff };
  }

  return { kind: null, insiders: 0, total_value: 0, window_start: sellCutoff };
}

function aggregateByInsider(
  rows: ReadonlyArray<Form4Row>,
  perInsiderMin: number,
): { insiders: number; total_value: number } {
  const byInsider = new Map<string, number>();
  for (const f of rows) {
    let v = 0;
    if (f.transaction_value != null && Number.isFinite(f.transaction_value)) {
      v = Math.abs(f.transaction_value);
    } else if (
      f.shares != null &&
      f.price_per_share != null &&
      Number.isFinite(f.shares) &&
      Number.isFinite(f.price_per_share)
    ) {
      v = Math.abs(f.shares * f.price_per_share);
    }
    byInsider.set(f.insider_name, (byInsider.get(f.insider_name) ?? 0) + v);
  }
  let count = 0;
  let total = 0;
  for (const [, v] of byInsider) {
    if (v >= perInsiderMin) {
      count += 1;
      total += v;
    }
  }
  return { insiders: count, total_value: total };
}

function insiderClusterEvent(ticker: string, asOf: string, state: ClusterState): AlertEvent {
  const valM = (state.total_value / 1_000_000).toFixed(1);
  return {
    key: alertKey("insider_cluster", ticker, asOf),
    kind: "insider_cluster",
    ticker,
    as_of: asOf,
    prior_as_of: null,
    title: `${ticker} insider ${state.kind} cluster — ${state.insiders} insiders / $${valM}M`,
    detail: `${state.insiders} insiders met the ${state.kind === "BUY" ? `$${BUY_VALUE_MIN / 1_000_000}M / ${BUY_WINDOW_DAYS}d` : `$${SELL_VALUE_MIN / 1_000_000}M / ${SELL_WINDOW_DAYS}d`} threshold in window ${state.window_start}..${asOf}. Aggregate qualifying value $${valM}M. ${state.kind === "BUY" ? "+5 override on S-score." : "-3 override on S-score (10b5-1 sales excluded)."}`,
    severity: state.kind === "BUY" ? "info" : "high",
    acked_at: null,
    acked_note: null,
  };
}

function isoDateMinusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function quarterlyEvent(qr: QuarterlyReviewRow): AlertEvent {
  const findings = qr.findings ?? [];
  const high = findings.filter((f) => f.severity === "high").length;
  const warn = findings.filter((f) => f.severity === "warn").length;
  const gap = findings.filter((f) => f.severity === "data_gap").length;
  const severity: AlertEvent["severity"] = high > 0 ? "high" : warn > 0 ? "warn" : "info";
  const parts: string[] = [];
  if (high > 0) parts.push(`${high} high`);
  if (warn > 0) parts.push(`${warn} warn`);
  if (gap > 0) parts.push(`${gap} data gap`);
  if (parts.length === 0) parts.push(`${findings.length} check(s) clean`);
  const lines = findings.map((f) => `  • [${f.severity}] ${f.summary}`);
  return {
    key: alertKey("quarterly_review", null, qr.as_of),
    kind: "quarterly_review",
    ticker: null,
    as_of: qr.as_of,
    prior_as_of: null,
    title: `Quarterly review ${qr.as_of} — ${parts.join(", ")}`,
    detail: lines.length > 0 ? lines.join("\n") : "No findings recorded.",
    severity,
    acked_at: qr.reviewed_at,
    acked_note: qr.reviewed_note,
  };
}

/**
 * Thesis-broken event from a position_pulse row (weekly-rescore Routine
 * writes these). Title intentionally reads "Thesis broken — {ticker}" per
 * spec. Detail is the Routine's prose reasoning; score_delta + insider
 * signal append as supplementary lines when present.
 */
function thesisBrokenEvent(p: PositionPulseRow): AlertEvent {
  const lines: string[] = [p.reasoning?.trim() || "No reasoning recorded."];
  if (p.score_delta != null && Number.isFinite(p.score_delta)) {
    const sign = p.score_delta > 0 ? "+" : "";
    lines.push(`Score Δ ${sign}${p.score_delta.toFixed(1)} since prior pulse.`);
  }
  if (p.insider_signal && p.insider_signal.trim().length > 0) {
    lines.push(`Insider signal: ${p.insider_signal.trim()}`);
  }
  const deltaSuffix =
    p.score_delta != null && Number.isFinite(p.score_delta)
      ? ` (Δ ${p.score_delta > 0 ? "+" : ""}${p.score_delta.toFixed(1)})`
      : "";
  return {
    key: alertKey("thesis_broken", p.ticker, p.as_of),
    kind: "thesis_broken",
    ticker: p.ticker,
    as_of: p.as_of,
    prior_as_of: null,
    title: `Thesis broken — ${p.ticker}${deltaSuffix}`,
    detail: lines.join("\n"),
    severity: "high",
    acked_at: null,
    acked_note: null,
  };
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

function emptySnapshot(envConfigured: boolean): AlertsSnapshot {
  return {
    events: [],
    unseen: 0,
    envConfigured,
    synthetic: false,
  };
}

export { ALERT_KIND_LABELS };

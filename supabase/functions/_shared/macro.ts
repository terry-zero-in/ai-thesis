// THS-49 — Macro gauge parsing + merge helpers (pure, no network).
//
// The macro_gauges table stores one row per as_of date with the latest known
// reading for each of the three Bayesian-gate inputs (NAAIM, AAII bull-bear
// 3-week MA, CNN Fear & Greed). Composite reads the most recent row at-or-
// before the run as_of (see `loadCompositeInputs` in supabase.ts).
//
// Sources:
//   - NAAIM: weekly Wednesday-of-prior-week reading, scraped from the public
//     "NAAIM Exposure Index" page's inline HTML table.
//   - F&G:   daily, fetched from CNN's public JSON endpoint
//     (https://production.dataviz.cnn.io/index/fearandgreed/graphdata).
//     Browser-style headers required or the endpoint returns 418.
//   - AAII:  weekly Thursday reading, **operator-curated** in v1. AAII's
//     public sentiment page is behind Imperva bot protection and cannot be
//     scraped headlessly. The orchestrator forward-fills the most recent
//     curated value on each daily ingest so composite's "latest row" semantics
//     still return a non-null spread between Thursday updates.
//
// Spec deviation vs §Out-of-scope item: that bullet listed "F&G via Perplexity"
// — we go direct to CNN's JSON endpoint. Less moving parts, no LLM
// hallucination risk, no new API key. Flagged in SESSION_NOTES.

// ---------------------------------------------------------------------------
// NAAIM page parser
// ---------------------------------------------------------------------------

export interface NaaimRow {
  /** ISO YYYY-MM-DD parsed from the page's MM/DD/YYYY format. */
  date: string;
  /** Mean exposure index (0..200). */
  value: number;
}

/**
 * Parse the NAAIM Exposure Index HTML table out of the public page. Tolerant
 * of surrounding chrome — accepts either the full page or just the <table>
 * fragment. Returns rows newest-first matching the table's natural order;
 * skips header and any malformed rows silently.
 *
 * Expected column order: Date | Mean | Bearish | Q1 | Q2 | Q3 | Bullish | Dev.
 * Only Date and Mean are extracted.
 */
export function parseNaaimTable(html: string): NaaimRow[] {
  const rows = extractTableRows(html);
  const out: NaaimRow[] = [];
  for (const cells of rows) {
    if (cells.length < 2) continue;
    const dateText = stripTags(cells[0]).trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateText)) continue; // skip header + malformed
    const valueText = stripTags(cells[1]).trim();
    const value = Number(valueText);
    if (!Number.isFinite(value)) continue;
    // MM/DD/YYYY → YYYY-MM-DD
    const [mm, dd, yyyy] = dateText.split("/");
    out.push({ date: `${yyyy}-${mm}-${dd}`, value });
  }
  return out;
}

function extractTableRows(html: string): string[][] {
  const out: string[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html)) !== null) {
    const inner = m[1];
    const cells: string[] = [];
    let c: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((c = cellRe.exec(inner)) !== null) cells.push(c[1]);
    if (cells.length > 0) out.push(cells);
  }
  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// CNN Fear & Greed JSON parser
// ---------------------------------------------------------------------------

export interface FearGreedRow {
  /** ISO YYYY-MM-DD (UTC). */
  date: string;
  /** Score 0..100. */
  value: number;
}

interface CnnFearGreedJson {
  fear_and_greed?: {
    score?: number | null;
    timestamp?: string | number | null;
  };
  fear_and_greed_historical?: {
    data?: Array<{ x?: number | null; y?: number | null }> | null;
  };
}

/**
 * Parse CNN's Fear & Greed graphdata JSON into a chronological series.
 *
 * - Current reading: lifted from `.fear_and_greed.{score,timestamp}` so today's
 *   row is included even if the historical array hasn't been updated yet.
 * - Historical: `.fear_and_greed_historical.data` is an array of
 *   `{ x: epoch_ms, y: score }` running ~1y back.
 *
 * Returns rows sorted oldest → newest, de-duped by date (latest reading for
 * a given calendar day wins).
 */
export function parseFearGreed(json: unknown): FearGreedRow[] {
  if (!json || typeof json !== "object") return [];
  const j = json as CnnFearGreedJson;
  const byDate = new Map<string, number>();

  const hist = j.fear_and_greed_historical?.data ?? [];
  for (const pt of hist) {
    if (!pt || typeof pt.x !== "number" || typeof pt.y !== "number") continue;
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
    const date = isoDateFromEpoch(pt.x);
    byDate.set(date, pt.y);
  }

  const cur = j.fear_and_greed;
  if (cur && typeof cur.score === "number" && Number.isFinite(cur.score)) {
    const ts = cur.timestamp;
    let curDate: string | null = null;
    if (typeof ts === "number" && Number.isFinite(ts)) {
      curDate = isoDateFromEpoch(ts);
    } else if (typeof ts === "string") {
      const parsed = Date.parse(ts);
      if (Number.isFinite(parsed)) curDate = isoDateFromEpoch(parsed);
    }
    if (curDate) byDate.set(curDate, cur.score);
  }

  return [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function isoDateFromEpoch(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// AAII 3-week spread aggregation
// ---------------------------------------------------------------------------

export interface AaiiWeekly {
  /** Survey reading date, ISO YYYY-MM-DD. */
  date: string;
  /** Net bull-bear spread for that week (bull% − bear%, e.g. +5.36). */
  spread: number;
}

/**
 * Three-week trailing average of the AAII bull-bear spread, anchored on
 * `asOf`. Spec gate: `aaii_3wk_spread > 30` triggers one Bayesian gate.
 *
 * Returns null when fewer than 3 weekly observations exist at-or-before
 * `asOf` — the composite job treats null as "no signal" rather than "no
 * gate hit," which is the safer default for a thin macro history.
 *
 * AAII publishes Thursdays for the prior week's survey; weekly cadence is
 * loose (52 ± 1 surveys/year). We use the 3 most recent weekly observations
 * by date rather than a fixed 21-day window.
 */
export function computeAaii3WkSpread(
  weekly: ReadonlyArray<AaiiWeekly>,
  asOf: string,
): number | null {
  if (!Array.isArray(weekly) || weekly.length === 0) return null;
  const eligible = weekly
    .filter((w) => w.date <= asOf && Number.isFinite(w.spread))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
  if (eligible.length < 3) return null;
  const last3 = eligible.slice(0, 3);
  const sum = last3.reduce((acc, w) => acc + w.spread, 0);
  return sum / 3;
}

// ---------------------------------------------------------------------------
// At-or-before selection (shared)
// ---------------------------------------------------------------------------

/**
 * Pick the latest row whose `date` is ≤ `asOf`. Returns null if no such row.
 * The series can be in any order; we don't mutate it.
 */
export function pickAtOrBefore<T extends { date: string }>(
  series: ReadonlyArray<T>,
  asOf: string,
): T | null {
  let best: T | null = null;
  for (const row of series) {
    if (row.date > asOf) continue;
    if (best === null || row.date > best.date) best = row;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Daily merge: build the macro_gauges row for `asOf` from each gauge's series.
// Forward-fills missing fields from `previousRow` (the latest stored macro_gauges
// row) so AAII (operator-curated) persists between Thursday updates and so a
// transient F&G fetch failure on day N doesn't blank the gate state.
// ---------------------------------------------------------------------------

export interface MacroRow {
  as_of: string;
  naaim: number | null;
  aaii_3wk_spread: number | null;
  fear_greed: number | null;
  source_notes: string | null;
}

export interface BuildMacroRowInput {
  asOf: string;
  naaim: ReadonlyArray<NaaimRow>;
  fearGreed: ReadonlyArray<FearGreedRow>;
  aaiiWeekly: ReadonlyArray<AaiiWeekly>; // operator-curated; usually empty in v1
  previousRow: MacroRow | null;
  sourceNotes?: string;
}

export function buildMacroRow(input: BuildMacroRowInput): MacroRow {
  const naaimRow = pickAtOrBefore(input.naaim, input.asOf);
  const fgRow = pickAtOrBefore(input.fearGreed, input.asOf);
  const aaiiSpread = computeAaii3WkSpread(input.aaiiWeekly, input.asOf);

  const prev = input.previousRow;
  return {
    as_of: input.asOf,
    naaim: naaimRow?.value ?? prev?.naaim ?? null,
    aaii_3wk_spread: aaiiSpread ?? prev?.aaii_3wk_spread ?? null,
    fear_greed: fgRow?.value ?? prev?.fear_greed ?? null,
    source_notes: input.sourceNotes ?? null,
  };
}

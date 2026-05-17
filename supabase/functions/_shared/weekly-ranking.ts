// THS-66 (E6.4) — Weekly ranking context builder.
//
// Pure helper. Assembles the structured input Opus 4.7 needs to produce
// the Sunday-evening weekly ranking memo:
//   - full universe ranking with current tier
//   - tier distribution (High/Medium/Low/Avoid counts)
//   - mean pairwise correlation among current High-tier names (from
//     `concentration_history.breakdown.signals.mean_corr` averaged across
//     the High roster — cheap proxy for "is the High book all moving
//     together this week?")
//   - bear-case flags per High name (recent SELL cluster, deprec flag,
//     concentration tax, week-over-week composite drop)
//
// The acceptance criterion is "output is structured (not free text);
// changes are auditable". The orchestrator prompts Claude to emit JSON
// matching `WeeklyRankingOutput` and parses the response — see
// renderWeeklyContextPayload + WEEKLY_RANKING_SYSTEM_PROMPT below.

export interface WeeklyScoreSnapshot {
  ticker: string;
  layer: number | null;
  layer_label: string | null;
  composite: number | null;
  final_score: number | null;
  tier: string | null;
}

export interface WeeklyInsiderSummary {
  ticker: string;
  buy_30d: number;        // count of qualifying BUY clusters in last 30d
  sell_30d: number;       // count of qualifying SELL clusters in last 30d
}

export interface WeeklyDepFlag {
  ticker: string;
  flagged_at: string;
  penalty_v: number | null;
  extension_years: number | null;
}

export interface WeeklyConcentration {
  ticker: string;
  tax: number;             // concentration_history.tax (negative or 0)
  mean_corr: number | null;
}

export interface WeeklyRankingInputs {
  as_of: string;
  current: ReadonlyArray<WeeklyScoreSnapshot>;
  prior: ReadonlyArray<WeeklyScoreSnapshot>;
  insiders: ReadonlyArray<WeeklyInsiderSummary>;
  depFlags: ReadonlyArray<WeeklyDepFlag>;
  concentration: ReadonlyArray<WeeklyConcentration>;
}

export interface BearCaseFlag {
  kind: "sell_cluster" | "dep_flag" | "concentration_tax" | "score_drop";
  detail: string;
}

export interface WeeklyContext {
  as_of: string;
  universe_size: number;
  tier_counts: Record<string, number>;
  ranking: Array<{
    ticker: string;
    layer: number | null;
    layer_label: string | null;
    final_score: number | null;
    tier: string | null;
    delta_w: number | null;
  }>;
  high_book: Array<{
    ticker: string;
    final_score: number | null;
    bear_cases: BearCaseFlag[];
    concentration_tax: number;
  }>;
  high_mean_corr: number | null;
  notes: string[];
}

export const SCORE_DROP_THRESHOLD = 5; // pt; week-over-week
export const CONCENTRATION_TAX_FLAG = -3; // surface as bear case if ≤ this

export function buildWeeklyContext(inp: WeeklyRankingInputs): WeeklyContext {
  const priorByTicker = new Map<string, WeeklyScoreSnapshot>();
  for (const p of inp.prior) priorByTicker.set(p.ticker, p);

  // Full ranking — by final_score desc, nulls last.
  const ranking = inp.current
    .slice()
    .sort((a, b) => (b.final_score ?? -Infinity) - (a.final_score ?? -Infinity))
    .map((r) => {
      const prior = priorByTicker.get(r.ticker);
      const delta_w =
        r.final_score != null && prior?.final_score != null
          ? r.final_score - prior.final_score
          : null;
      return {
        ticker: r.ticker,
        layer: r.layer,
        layer_label: r.layer_label,
        final_score: r.final_score,
        tier: r.tier,
        delta_w,
      };
    });

  const tier_counts: Record<string, number> = { High: 0, Medium: 0, Low: 0, Avoid: 0, null: 0 };
  for (const r of inp.current) tier_counts[r.tier ?? "null"] += 1;

  // High book + bear cases.
  const insiderByTicker = new Map<string, WeeklyInsiderSummary>();
  for (const i of inp.insiders) insiderByTicker.set(i.ticker, i);

  const depByTicker = new Map<string, WeeklyDepFlag[]>();
  for (const d of inp.depFlags) {
    const arr = depByTicker.get(d.ticker) ?? [];
    arr.push(d);
    depByTicker.set(d.ticker, arr);
  }

  const concByTicker = new Map<string, WeeklyConcentration>();
  for (const c of inp.concentration) concByTicker.set(c.ticker, c);

  const highBook = inp.current
    .filter((r) => r.tier === "High")
    .map((r) => {
      const bear: BearCaseFlag[] = [];
      const ins = insiderByTicker.get(r.ticker);
      if (ins && ins.sell_30d > 0) {
        bear.push({
          kind: "sell_cluster",
          detail: `${ins.sell_30d} insider SELL cluster(s) qualifying in the last 30d.`,
        });
      }
      const dep = depByTicker.get(r.ticker);
      if (dep && dep.length > 0) {
        const latest = dep[0];
        bear.push({
          kind: "dep_flag",
          detail: `Depreciation extension flagged ${latest.flagged_at}; penalty_v=${latest.penalty_v ?? "?"}.`,
        });
      }
      const conc = concByTicker.get(r.ticker);
      if (conc && conc.tax <= CONCENTRATION_TAX_FLAG) {
        bear.push({
          kind: "concentration_tax",
          detail: `Concentration tax ${conc.tax.toFixed(1)}pt (mean correlation ${conc.mean_corr?.toFixed(2) ?? "n/a"}).`,
        });
      }
      const prior = priorByTicker.get(r.ticker);
      if (
        r.final_score != null &&
        prior?.final_score != null &&
        r.final_score - prior.final_score <= -SCORE_DROP_THRESHOLD
      ) {
        bear.push({
          kind: "score_drop",
          detail: `Final score dropped ${(r.final_score - prior.final_score).toFixed(1)}pt week-over-week.`,
        });
      }
      return {
        ticker: r.ticker,
        final_score: r.final_score,
        bear_cases: bear,
        concentration_tax: conc?.tax ?? 0,
      };
    });

  // High mean correlation — mean of mean_corr for the High roster.
  let highMeanCorr: number | null = null;
  const corrSamples = highBook
    .map((h) => concByTicker.get(h.ticker)?.mean_corr)
    .filter((c): c is number => c != null && Number.isFinite(c));
  if (corrSamples.length > 0) {
    highMeanCorr = corrSamples.reduce((a, b) => a + b, 0) / corrSamples.length;
  }

  const notes: string[] = [];
  if (inp.current.length === 0) notes.push("No scores available for this as_of.");
  if (inp.prior.length === 0) notes.push("No prior-week snapshot — delta_w omitted.");
  if (inp.concentration.length === 0) notes.push("No concentration_history rows — tax data missing.");

  return {
    as_of: inp.as_of,
    universe_size: inp.current.length,
    tier_counts,
    ranking,
    high_book: highBook,
    high_mean_corr: highMeanCorr,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering — same split as memo-context.ts (stable system / volatile
// user payload) so the cache prefix is preserved week-over-week.
// ---------------------------------------------------------------------------

export const WEEKLY_RANKING_SYSTEM_PROMPT = `
You are the weekly-ranking analyst for the AI Thesis v2 investing engine.
You produce the Sunday-evening structured memo for the portfolio operator.

You receive a JSON payload with the full universe ranking (final_score
desc), tier counts, the High-conviction book with pre-computed bear-case
flags, prior-week deltas, and the mean pairwise correlation among the
current High names.

Your job:
1. Rank the High book by current final_score.
2. For each High name, write a concise bear case (2-3 sentences) that
   synthesizes the supplied flags (insider SELL clusters, depreciation
   flags, concentration tax, score drops). If no flags, write
   "No bear-case flags this week — but verify <one concrete check>".
3. Suggest adjustments: add / trim / exit. Be specific. Use the flags
   and the score deltas as your basis — never invent a news catalyst.
4. Summarize cross-book risk: tier distribution, High-mean correlation
   level, and which layers carry the most conviction.

OUTPUT FORMAT — STRICT JSON, no other text, matching this schema:

{
  "headline": "<one sentence: the single most actionable theme>",
  "summary": "<2-3 sentences on cross-book state, tier distribution, correlation>",
  "high_book": [
    {
      "ticker": "<UPPERCASE>",
      "final_score": <number>,
      "bear_case": "<2-3 sentences>",
      "action": "add" | "hold" | "trim" | "exit",
      "action_rationale": "<one sentence>"
    }
  ],
  "cross_book_notes": [
    "<one-line observation>",
    "..."
  ],
  "watch_next_week": [
    "<concrete event or check>",
    "..."
  ]
}

Output JSON ONLY. No markdown fences, no commentary, no leading
whitespace. The output must be parseable with JSON.parse().
Tickers in UPPERCASE. Numbers carry at most 1 decimal place.
`.trim();

export function renderWeeklyContextPayload(ctx: WeeklyContext): string {
  return JSON.stringify({
    as_of: ctx.as_of,
    universe_size: ctx.universe_size,
    tier_counts: ctx.tier_counts,
    high_mean_corr: round2(ctx.high_mean_corr),
    notes: ctx.notes,
    high_book: ctx.high_book.map((h) => ({
      ticker: h.ticker,
      final_score: round1(h.final_score),
      concentration_tax: round1(h.concentration_tax),
      bear_cases: h.bear_cases,
    })),
    ranking: ctx.ranking.map((r) => ({
      ticker: r.ticker,
      layer: r.layer,
      layer_label: r.layer_label,
      final_score: round1(r.final_score),
      tier: r.tier,
      delta_w: round1(r.delta_w),
    })),
  }, null, 2);
}

function round1(n: number | null): number | null {
  if (n == null) return null;
  return Math.round(n * 10) / 10;
}

function round2(n: number | null): number | null {
  if (n == null) return null;
  return Math.round(n * 100) / 100;
}

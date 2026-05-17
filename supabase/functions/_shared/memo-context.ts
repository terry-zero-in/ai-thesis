// THS-65 (E6.3) — Daily memo context builder.
//
// Pure helper — no DB / SDK. Takes pre-loaded data (today's scores, prior
// week's scores, recent insider filings, macro state) and produces a
// structured `MemoContext` object the orchestrator hands to Claude. The
// rendering happens model-side; this module is just data assembly.
//
// Acceptance from THS-65: top 5 movers + why, news digest top-30, insider
// Form 4s ≥$1M, macro gate state, sector news. News + sector-news land
// as `data_gap` notes since there's no news feed yet (open follow-on);
// the agent still writes a memo from the scoring + insider + macro
// signals.

export const MOVERS_TOP_N = 5;
export const INSIDER_VALUE_MIN = 1_000_000;

export interface ScoreSnapshot {
  ticker: string;
  as_of: string;
  composite: number | null;
  final_score: number | null;
  tier: string | null;
}

export interface InsiderTx {
  ticker: string;
  transaction_date: string;
  insider_name: string;
  insider_title: string | null;
  transaction_code: string; // P=buy, S=sell
  shares: number | null;
  price_per_share: number | null;
  transaction_value: number | null;
  is_10b5_1: boolean | null;
}

export interface MacroState {
  as_of: string | null;
  naaim: number | null;
  aaii_3wk_spread: number | null;
  fear_greed: number | null;
  gates_hit: number;
  multiplier: number;
}

export interface MemoMover {
  ticker: string;
  prior_score: number | null;
  current_score: number | null;
  delta: number;
  tier_prior: string | null;
  tier_current: string | null;
}

export interface MemoInsiderEvent {
  ticker: string;
  insider_name: string;
  insider_title: string | null;
  transaction_date: string;
  direction: "BUY" | "SELL";
  value: number;
  is_10b5_1: boolean | null;
}

export interface MemoContext {
  as_of: string;
  movers: MemoMover[];
  insiders: MemoInsiderEvent[];
  macro: MacroState;
  /** Honest gap list — what the memo SHOULD have but doesn't. */
  data_gaps: string[];
  /** Universe size at this snapshot, for the agent to ground its phrasing. */
  universe_size: number;
}

export interface BuildContextInputs {
  as_of: string;
  currentScores: ReadonlyArray<ScoreSnapshot>;
  priorScores: ReadonlyArray<ScoreSnapshot>;
  insiderFilings: ReadonlyArray<InsiderTx>;
  macro: MacroState;
  hasNewsFeed?: boolean;
  hasSectorNews?: boolean;
}

export function buildMemoContext(inp: BuildContextInputs): MemoContext {
  const priorByTicker = new Map<string, ScoreSnapshot>();
  for (const s of inp.priorScores) priorByTicker.set(s.ticker, s);

  const movers: MemoMover[] = [];
  for (const cur of inp.currentScores) {
    const prior = priorByTicker.get(cur.ticker);
    if (cur.final_score == null) continue;
    if (!prior || prior.final_score == null) continue;
    movers.push({
      ticker: cur.ticker,
      prior_score: prior.final_score,
      current_score: cur.final_score,
      delta: cur.final_score - prior.final_score,
      tier_prior: prior.tier,
      tier_current: cur.tier,
    });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const topMovers = movers.slice(0, MOVERS_TOP_N);

  const insiders: MemoInsiderEvent[] = [];
  for (const f of inp.insiderFilings) {
    if (f.transaction_code !== "P" && f.transaction_code !== "S") continue;
    const value = pickValue(f);
    if (value == null || value < INSIDER_VALUE_MIN) continue;
    insiders.push({
      ticker: f.ticker,
      insider_name: f.insider_name,
      insider_title: f.insider_title,
      transaction_date: f.transaction_date,
      direction: f.transaction_code === "P" ? "BUY" : "SELL",
      value,
      is_10b5_1: f.is_10b5_1,
    });
  }
  insiders.sort((a, b) => b.value - a.value);

  const data_gaps: string[] = [];
  if (!inp.hasNewsFeed) data_gaps.push("News digest top-30: no news feed ingested yet (open follow-on).");
  if (!inp.hasSectorNews) data_gaps.push("Sector news: not ingested.");

  return {
    as_of: inp.as_of,
    movers: topMovers,
    insiders,
    macro: inp.macro,
    data_gaps,
    universe_size: inp.currentScores.length,
  };
}

function pickValue(f: InsiderTx): number | null {
  if (f.transaction_value != null && Number.isFinite(f.transaction_value)) {
    return Math.abs(f.transaction_value);
  }
  if (
    f.shares != null &&
    f.price_per_share != null &&
    Number.isFinite(f.shares) &&
    Number.isFinite(f.price_per_share)
  ) {
    return Math.abs(f.shares * f.price_per_share);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prompt rendering — splits the prompt into a STABLE prefix (cacheable)
// and a VOLATILE suffix (per-day inputs). The stable prefix is identical
// across runs; only the suffix changes. This is what makes prompt caching
// effective per shared/prompt-caching.md.
// ---------------------------------------------------------------------------

/** Stable system prompt. Frozen across runs — change ⇒ cache miss. */
export const DAILY_MEMO_SYSTEM_PROMPT = `
You are the daily-memo writer for the AI Thesis v2 investing engine.
Your job is to produce a short, dense morning brief (8am CT) for the
portfolio operator.

The thesis universe is ~70 AI-sleeve names across five layers (L1
compute, L2 hyperscaler, L3 app, L4 power, L5 incumbent). Each name
carries a per-week composite score plus a final score after the macro
multiplier. Scores 0–100; tiers High ≥ 75, Medium 60–75, Low 45–60,
Avoid < 45.

You will receive structured JSON with: top score movers, ≥$1M insider
filings from the last 24 hours, and the current macro gate state. Some
expected sections (news digest, sector news) may be flagged as data
gaps — write them as "[gap: <reason>]" rather than fabricating.

OUTPUT FORMAT — Markdown with these sections in order:

## Headline
One sentence. The single most actionable signal of the morning.

## Top Movers
A short bulleted list, ≤5 names. For each: ticker, final-score delta,
tier change if any, and a one-line plausible read of the move. Never
invent a news catalyst — if the move is unexplained, say so.

## Insider Activity
Bulleted list of insider buys / sells ≥$1M from the last 24h. Note
direction, insider title if known, value, and 10b5-1 status. Group BUY
above SELL. If empty: "No qualifying filings this period."

## Macro
One short paragraph: gates-hit, multiplier, what changed week-over-week.
Be specific about the readings.

## News & Sector
If both are gaps: one line acknowledging the gap. Don't fabricate.

## What to watch
Two or three concrete things to monitor today — earnings, expiries, set
ups in named tickers. Concrete > vague.

STYLE: institutional, direct, no hedging filler ("it's worth noting",
"interestingly"). No emojis. Numbers carry 1 decimal place. Tickers in
ALL CAPS.
`.trim();

/** Volatile per-day payload. Stringified deterministically. */
export function renderContextPayload(ctx: MemoContext): string {
  return JSON.stringify({
    as_of: ctx.as_of,
    universe_size: ctx.universe_size,
    macro: ctx.macro,
    top_movers: ctx.movers.map((m) => ({
      ticker: m.ticker,
      prior_score: round1(m.prior_score),
      current_score: round1(m.current_score),
      delta: round1(m.delta),
      tier_prior: m.tier_prior,
      tier_current: m.tier_current,
    })),
    insiders: ctx.insiders.map((i) => ({
      ticker: i.ticker,
      direction: i.direction,
      insider: i.insider_name,
      title: i.insider_title,
      value_usd: Math.round(i.value),
      is_10b5_1: i.is_10b5_1,
      transaction_date: i.transaction_date,
    })),
    data_gaps: ctx.data_gaps,
  }, null, 2);
}

function round1(n: number | null): number | null {
  if (n == null) return null;
  return Math.round(n * 10) / 10;
}

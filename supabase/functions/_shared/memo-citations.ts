// THS-10 / THS-113 — Memo citation validator (autoresearch Lane C).
//
// Deterministic, pure (no DB / SDK / network). Given a synthesized memo
// (markdown) and the EXACT MemoContext it was generated from, it extracts the
// memo's factual claims and checks each against the context. A claim that does
// not trace to a context datum is a "leak". The contract is STRICT (Terry,
// 2026-06-24): tickers AND numbers must both validate.
//
// "Zero UNHANDLED citation-validation failures" (THS-10/THS-113): every
// detected mismatch is returned as a structured leak — never thrown, never
// swallowed. The validator must not crash on a malformed memo; `unhandled`
// counts claims it could not classify and must be 0 by construction.
//
// This module is wired into the autoresearch Lane C harness + its unit tests.
// Wiring it into the live compute-daily-memo pipeline (post-generation gate)
// is the lane's first real experiment / a follow-on — NOT done here, so live
// memo behavior is unchanged.
//
// Strictness knobs live in CitationOpts (the Lane C autoresearch tunable —
// drive leak rate → 0 by improving extraction precision, never by loosening
// what counts as a leak past the strict contract).

import type { MemoContext } from "./memo-context.ts";

export interface CitationOpts {
  /** Universe ticker set — a token in here but absent from context is a leak. */
  universe?: ReadonlyArray<string>;
  /** Tolerance for score/delta/macro numeric matches (default ±0.1, the memo's
   *  stated 1-decimal precision). Dollar values match within `dollarTolFrac`. */
  numTol?: number;
  dollarTolFrac?: number;
  /** Tokens that look like tickers but are not (acronyms, units, section words). */
  stoplist?: ReadonlyArray<string>;
}

export type LeakKind = "ticker" | "delta" | "score" | "value" | "macro";

export interface CitationLeak {
  kind: LeakKind;
  text: string;       // the offending token as it appeared
  reason: string;     // why it failed to validate
}

export interface CitationAudit {
  total_claims: number;
  ticker_claims: number;
  number_claims: number;
  leaks: CitationLeak[];
  leak_rate: number;  // leaks / total_claims; 0 when there are no claims
  unhandled: number;  // claims that could not be classified (must be 0)
}

const DEFAULT_STOP = [
  "AI", "US", "USD", "CT", "ET", "PT", "EST", "CST", "CDT", "UTC", "Q1", "Q2",
  "Q3", "Q4", "CEO", "CFO", "COO", "CTO", "ETF", "BUY", "SELL", "GAAP", "YOY",
  "QOQ", "EPS", "FCF", "ROIC", "PEG", "NAAIM", "AAII", "JSON", "PC1", "PPA",
  "PPAS", "EUV", "HPC", "TPU", "CUDA", "IG", "IRP", "NOI", "RUBS", "AM", "PM",
  "OK", "NO", "ON", "OR", "AND", "THE", "A", "I", "M", "B", "K", "VS", "PE",
  "DD", "DC", "EBITDA", "SEC", "FY", "YTD", "WOW",
];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** All numeric facts in the context, by kind, for matching. */
function contextNumbers(ctx: MemoContext) {
  const deltas: number[] = [];
  const scores: number[] = [];
  const values: number[] = [];
  const macro: number[] = [];
  for (const m of ctx.movers) {
    deltas.push(round1(m.delta));
    if (m.prior_score != null) scores.push(round1(m.prior_score));
    if (m.current_score != null) scores.push(round1(m.current_score));
  }
  for (const i of ctx.insiders) values.push(Math.round(i.value));
  const g = ctx.macro;
  for (const v of [g.naaim, g.aaii_3wk_spread, g.fear_greed, g.multiplier, g.gates_hit]) {
    if (v != null && Number.isFinite(v)) macro.push(v);
  }
  return { deltas, scores, values, macro };
}

function near(target: number, pool: number[], tol: number): boolean {
  return pool.some((p) => Math.abs(p - target) <= tol);
}

function dollarNear(target: number, pool: number[], frac: number): boolean {
  return pool.some((p) => {
    const t = Math.max(Math.abs(p), 1);
    return Math.abs(p - target) <= t * frac || Math.abs(p - target) <= 0.5;
  });
}

/** Parse a $-value token like "$1.5M", "$2,300,000", "$1.2 billion" → USD. */
function parseDollar(tok: string): number | null {
  const m = tok.match(/\$\s?([\d,]+(?:\.\d+)?)\s?(M|MM|million|B|billion|K|thousand)?/i);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit === "k" || unit === "thousand") n *= 1e3;
  else if (unit === "m" || unit === "mm" || unit === "million") n *= 1e6;
  else if (unit === "b" || unit === "billion") n *= 1e9;
  return n;
}

/**
 * Validate a memo's citations against the context it was generated from.
 * Never throws on a normal string input; classification failures surface as
 * `unhandled`, mismatches as `leaks`.
 */
export function validateMemoCitations(
  memo: string,
  ctx: MemoContext,
  opts: CitationOpts = {},
): CitationAudit {
  const numTol = opts.numTol ?? 0.1;
  const dollarTolFrac = opts.dollarTolFrac ?? 0.02;
  const stop = new Set((opts.stoplist ?? DEFAULT_STOP).map((s) => s.toUpperCase()));
  const universe = new Set((opts.universe ?? []).map((s) => s.toUpperCase()));
  const ctxTickers = new Set<string>();
  for (const m of ctx.movers) ctxTickers.add(m.ticker.toUpperCase());
  for (const i of ctx.insiders) ctxTickers.add(i.ticker.toUpperCase());
  const nums = contextNumbers(ctx);

  const leaks: CitationLeak[] = [];
  let tickerClaims = 0;
  let numberClaims = 0;
  let unhandled = 0;

  // Strip ISO dates + clock times so their digits/hyphens aren't misread as
  // deltas or scores (e.g. "2026-06-24" must not parse as a "-06" delta).
  const text = (typeof memo === "string" ? memo : String(memo ?? ""))
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi, " ")
    .replace(/\b24h\b/gi, " ");

  // ── ticker claims ──────────────────────────────────────────────────────────
  for (const mt of text.matchAll(/\b[A-Z]{1,5}\b/g)) {
    const tok = mt[0];
    if (stop.has(tok)) continue;            // acronym / unit / section word
    if (tok.length < 2) continue;           // single letters aren't ticker claims
    const inCtx = ctxTickers.has(tok);
    const inUniv = universe.has(tok);
    if (!inCtx && !inUniv) continue;        // not a recognized ticker → not a claim
    tickerClaims++;
    if (!inCtx) {
      leaks.push({
        kind: "ticker",
        text: tok,
        reason: inUniv
          ? "universe ticker discussed but absent from this memo's context"
          : "ticker not present in the provided context",
      });
    }
  }

  // ── number claims (priority: dollar > signed-delta > 1-decimal score) ───────
  // Dollar values.
  for (const mt of text.matchAll(/\$\s?[\d,]+(?:\.\d+)?\s?(?:MM|M|million|B|billion|K|thousand)?/gi)) {
    const tok = mt[0];
    const val = parseDollar(tok);
    numberClaims++;
    if (val == null) { unhandled++; continue; }
    if (!dollarNear(val, nums.values, dollarTolFrac)) {
      leaks.push({ kind: "value", text: tok, reason: "dollar value does not match any context insider value" });
    }
  }
  // Strip dollar spans so their digits aren't re-counted as scores/deltas.
  const noDollars = text.replace(/\$\s?[\d,]+(?:\.\d+)?\s?(?:MM|M|million|B|billion|K|thousand)?/gi, " ");

  // Signed deltas, e.g. "+4.2", "-3.0", "−5.0". Sign must be a real leading
  // sign (not a hyphen between word/number chars) and the number standalone.
  for (const mt of noDollars.matchAll(/(?<![\w.])[+\-−]\d+(?:\.\d+)?(?![\w])/g)) {
    const tok = mt[0];
    const val = Number(tok.replace(/−/, "-").replace(/\s/g, ""));
    numberClaims++;
    if (!Number.isFinite(val)) { unhandled++; continue; }
    if (!near(val, nums.deltas, numTol)) {
      leaks.push({ kind: "delta", text: tok, reason: "signed delta does not match any context mover delta" });
    }
  }
  const noSigned = noDollars.replace(/[+\-−]\s?\d+(?:\.\d+)?/g, " ");

  // Unsigned 1-decimal scores in [0,100] (the memo's stated number format).
  for (const mt of noSigned.matchAll(/\b\d{1,3}\.\d\b/g)) {
    const tok = mt[0];
    const val = Number(tok);
    if (val < 0 || val > 100) continue;     // out-of-range → not a score claim
    numberClaims++;
    const ok = near(val, nums.scores, numTol) || near(val, nums.macro, numTol) ||
               near(val, nums.deltas, numTol);
    if (!ok) {
      leaks.push({ kind: "score", text: tok, reason: "score does not match any context score/macro reading" });
    }
  }

  const total = tickerClaims + numberClaims;
  return {
    total_claims: total,
    ticker_claims: tickerClaims,
    number_claims: numberClaims,
    leaks,
    leak_rate: total === 0 ? 0 : leaks.length / total,
    unhandled,
  };
}

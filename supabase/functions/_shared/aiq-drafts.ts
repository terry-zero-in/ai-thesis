// THS-47 (E3.2) — AIQ rubric draft prompt + parser.
//
// Pure helpers. The orchestrator (generate-aiq-draft edge function)
// fetches the most recent 10-K (SEC EDGAR) + earnings transcript (FMP)
// per ticker, hands them to Claude with the rubric prompt below, and
// expects strict JSON back per the schema.
//
// Per Terry's confirmation: drafts go to `aiq_drafts` only — nothing
// writes to the canonical `aiq_rubric` until he approves on /aiq-drafts.

export const AIQ_RUBRIC_SYSTEM_PROMPT = `
You are scoring tickers against the AI Thesis v2 AIQ rubric — a 6-dimension
quality assessment focused on AI exposure and durability. The rubric is
applied to each name in the investable universe and re-scored quarterly.

Score each dimension as an integer in its range. Total must equal the sum.

DIMENSIONS (with criteria):

1. **disclosure_pts (0-20)** — How explicitly does management break out
   AI-related revenue, capex, and segment performance?
   - 20: Explicit AI revenue line item, AI segment guidance, capex breakdown
   - 15: AI revenue/capex disclosed in MD&A but not as a segment
   - 10: AI discussed in transcripts; revenue impact estimable but not stated
   - 5:  AI tangentially mentioned; no revenue/capex attribution
   - 0:  No AI disclosure

2. **defensibility_pts (0-20)** — How durable is the AI moat?
   - 20: Hard-to-replicate moat (CUDA, EUV monopoly, fab process leadership)
   - 15: Strong moat (Ethernet-for-AI, custom silicon design, deep enterprise hooks)
   - 10: Decent moat (incumbent enterprise relationships, distribution)
   - 5:  Limited moat (commoditizing layer)
   - 0:  No durable advantage

3. **concentration_pts (0-15)** — Customer / end-market concentration.
   Higher = MORE diversified (less concentrated).
   - 15: Highly diversified customer base across many verticals
   - 12: Diversified across hyperscalers + non-hyperscaler verticals
   - 8:  Concentrated but with several major customers
   - 5:  Top customer is dominant (25-50% of revenue)
   - 0:  Single-customer dependence

4. **capex_eff_pts (0-15)** — Capex efficiency (revenue per dollar of capex,
   margin trajectory, FCF generation).
   - 15: Top-of-class capex efficiency; strong incremental ROIC
   - 12: Above-average capex efficiency; FCF growing
   - 8:  Average — capex matches revenue growth
   - 5:  Below average — capex outpacing revenue, FCF compressing
   - 0:  Worst-in-class (Reality Labs-style)

5. **indep_demand_pts (0-15)** — How much of demand is independent of
   hyperscaler capex cycles?
   - 15: Most demand from outside hyperscalers (enterprise, gov, consumer)
   - 12: Mixed customer base, with substantial non-hyperscaler demand
   - 10: Some independent demand but hyperscalers are the swing factor
   - 5:  Almost entirely hyperscaler-driven
   - 0:  Single-cohort customer base

6. **accounting_pts (0-15)** — Accounting cleanliness and conservatism.
   - 15: Clean — no useful-life extensions, no aggressive revenue recognition,
        no related-party concerns, no Burry-style overstatement flags
   - 12: Mostly clean; minor SBC dilution or one-time charges
   - 10: Some flags — modest revenue-recognition aggressiveness or SBC
   - 5:  Multiple flags — depreciation extension OR aggressive recognition
   - 0:  Severe — Burry-style overstatement, multiple useful-life extensions,
        related-party disclosures

GROUND RULES:
- Score from the source material provided. If a dimension has insufficient
  evidence, score conservatively (mid-range) and note the gap.
- Every dimension must include a one-sentence rationale citing the source
  type ("transcript", "10-K", "10-Q") and roughly where the evidence appears.
- Do not invent facts. If the transcript / 10-K doesn't address a
  dimension, say so explicitly in the notes.

OUTPUT FORMAT — STRICT JSON, no other text:

{
  "ticker": "<UPPERCASE>",
  "disclosure_pts": <int 0-20>,
  "defensibility_pts": <int 0-20>,
  "concentration_pts": <int 0-15>,
  "capex_eff_pts": <int 0-15>,
  "indep_demand_pts": <int 0-15>,
  "accounting_pts": <int 0-15>,
  "notes": {
    "disclosure": "<sentence with citation>",
    "defensibility": "<sentence with citation>",
    "concentration": "<sentence with citation>",
    "capex_eff": "<sentence with citation>",
    "indep_demand": "<sentence with citation>",
    "accounting": "<sentence with citation>"
  }
}

Output JSON ONLY. No markdown fences, no commentary. Must parse with
JSON.parse(). Tickers UPPERCASE.
`.trim();

export interface AiqDraftSources {
  ticker: string;
  ten_k_url: string | null;
  ten_k_excerpt: string | null;
  transcript_url: string | null;
  transcript_excerpt: string | null;
}

export function renderAiqDraftPayload(sources: AiqDraftSources): string {
  return JSON.stringify({
    ticker: sources.ticker,
    sources: {
      ten_k: {
        url: sources.ten_k_url,
        excerpt: sources.ten_k_excerpt ?? "(not available — score conservatively)",
      },
      transcript: {
        url: sources.transcript_url,
        excerpt: sources.transcript_excerpt ?? "(not available — score conservatively)",
      },
    },
  }, null, 2);
}

export interface AiqDraftResult {
  ticker: string;
  disclosure_pts: number;
  defensibility_pts: number;
  concentration_pts: number;
  capex_eff_pts: number;
  indep_demand_pts: number;
  accounting_pts: number;
  notes: {
    disclosure: string;
    defensibility: string;
    concentration: string;
    capex_eff: string;
    indep_demand: string;
    accounting: string;
  };
}

export function parseAiqDraft(text: string): AiqDraftResult {
  let candidate = text.trim();
  const fenceMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) candidate = fenceMatch[1].trim();
  const parsed = JSON.parse(candidate);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("expected object root");
  }
  for (const k of [
    "disclosure_pts",
    "defensibility_pts",
    "concentration_pts",
    "capex_eff_pts",
    "indep_demand_pts",
    "accounting_pts",
  ]) {
    if (!Number.isInteger(parsed[k])) {
      throw new Error(`missing or non-integer ${k}`);
    }
  }
  if (typeof parsed.ticker !== "string") throw new Error("missing ticker");
  if (typeof parsed.notes !== "object" || parsed.notes === null) {
    throw new Error("missing notes object");
  }
  for (const k of ["disclosure", "defensibility", "concentration", "capex_eff", "indep_demand", "accounting"]) {
    if (typeof parsed.notes[k] !== "string") {
      throw new Error(`missing or non-string notes.${k}`);
    }
  }
  validateRange(parsed.disclosure_pts, 0, 20, "disclosure_pts");
  validateRange(parsed.defensibility_pts, 0, 20, "defensibility_pts");
  validateRange(parsed.concentration_pts, 0, 15, "concentration_pts");
  validateRange(parsed.capex_eff_pts, 0, 15, "capex_eff_pts");
  validateRange(parsed.indep_demand_pts, 0, 15, "indep_demand_pts");
  validateRange(parsed.accounting_pts, 0, 15, "accounting_pts");
  return parsed as AiqDraftResult;
}

function validateRange(v: number, min: number, max: number, name: string) {
  if (v < min || v > max) {
    throw new Error(`${name} out of range [${min},${max}]: ${v}`);
  }
}

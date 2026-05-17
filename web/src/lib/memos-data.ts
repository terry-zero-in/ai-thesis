/**
 * Server-only loader for the /memos route.
 *
 * Pulls the most recent daily + weekly memos from the `memos` table.
 * `failed=true` rows are kept and surfaced so the operator sees WHY a
 * memo is missing instead of an unexplained gap.
 */
import { getSupabaseServer } from "./supabase/server";

export type MemoKind = "daily" | "weekly";

export type MemoAction = "add" | "hold" | "trim" | "exit";

export interface WeeklyHighBookItem {
  ticker: string;
  final_score: number | null;
  bear_case: string;
  action: MemoAction;
  action_rationale: string;
}

export interface WeeklyMemoParsed {
  headline: string;
  summary: string;
  high_book: WeeklyHighBookItem[];
  cross_book_notes: string[];
  watch_next_week: string[];
}

export interface MemoSections {
  parsed: WeeklyMemoParsed | null;
  parse_error?: string | null;
}

export interface MemoRow {
  id: string;
  kind: MemoKind;
  as_of: string;
  headline: string | null;
  body: string | null;
  sections: MemoSections | null;
  model: string | null;
  generated_at: string;
  failed: boolean;
  error: string | null;
}

export interface MemosSnapshot {
  rows: MemoRow[];
  envConfigured: boolean;
  synthetic: boolean;
}

const LIMIT = 30;

export async function getMemosSnapshot(): Promise<MemosSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) return synthesize(false);

  const { data, error } = await sb
    .from("memos")
    .select("id,kind,as_of,headline,body,sections,model,generated_at,failed,error")
    .order("generated_at", { ascending: false })
    .limit(LIMIT);
  if (error || !data) return synthesize(true);
  if (data.length === 0) return synthesize(true);

  return {
    rows: (data as MemoRow[]).slice(),
    envConfigured: true,
    synthetic: false,
  };
}

function synthesize(envConfigured: boolean): MemosSnapshot {
  const rows: MemoRow[] = [
    {
      id: "fixture-weekly-1",
      kind: "weekly",
      as_of: "2026-05-17",
      headline: "Cut TSM by half on accelerating high-book correlation; redeploy to ANET + ASML.",
      body: "[structured weekly — see sections.parsed]",
      sections: {
        parsed: {
          headline: "Cut TSM by half on accelerating high-book correlation; redeploy to ANET + ASML.",
          summary:
            "High book holding at 11 names but mean pairwise correlation ticked to 0.74 (was 0.66 last week). Tier distribution: 11 High / 18 Medium / 9 Low / 12 Cut. Macro multiplier 0.95.",
          high_book: [
            {
              ticker: "TSM",
              final_score: 82.2,
              bear_case:
                "Concentration tax now -3 from supply-chain PC1 loading rising. Stock is the most-crowded High-book holding and benefits least from a hyperscaler capex pullback.",
              action: "trim",
              action_rationale: "Cut to half-weight to reduce factor exposure to the dominant compute axis.",
            },
            {
              ticker: "ANET",
              final_score: 78.4,
              bear_case: "No bear-case flags this week — verify 2026 capex guide stays > $4B.",
              action: "add",
              action_rationale: "Lowest-correlation High-book name; absorbs TSM trim cleanly.",
            },
          ],
          cross_book_notes: [
            "11 High, 18 Medium — Medium book widening as L4 power names continue rerating.",
            "High-mean correlation 0.74 (was 0.66) — diversification eroding.",
          ],
          watch_next_week: [
            "META FY25 10-K disclosure follow-up on useful-life extension.",
            "AMD Q1 earnings — AI revenue disclosure could move L1 Compute tier line.",
          ],
        },
      },
      model: "claude-opus-4-7",
      generated_at: "2026-05-17T23:30:08Z",
      failed: false,
      error: null,
    },
    {
      id: "fixture-daily-1",
      kind: "daily",
      as_of: "2026-05-15",
      headline: "NVDA insider BUY cluster ($6.2M / 4 names) drives the morning's most actionable signal.",
      body: [
        "## Headline",
        "NVDA insider BUY cluster ($6.2M / 4 names) drives the morning's most actionable signal.",
        "",
        "## Top Movers",
        "- **NVDA** final +3.2 → 78.9 (High). 4-insider BUY cluster crossed the $1M threshold.",
        "- **AVGO** final -2.7 → 74.1 (High→Medium). Composite slipped on Q-score revision; no news catalyst.",
        "- **GOOGL** final +1.8 → 75.6. Cloud + AIQ marginally repriced.",
        "",
        "## Insider Activity",
        "- BUY · NVDA · Jane Doe (CFO) · $2.1M · open-market",
        "- BUY · NVDA · 3 other insiders aggregating $4.1M",
        "- SELL · ORCL · Director · $1.8M · 10b5-1",
        "",
        "## Macro",
        "1 gate hit (NAAIM 96.7 > 90). Multiplier 0.95. Unchanged week-over-week.",
        "",
        "## News & Sector",
        "[gap: news feed not ingested]",
        "",
        "## What to watch",
        "- AVGO 13F filing window opens Friday — Burry position update likely.",
        "- META depreciation flag follow-up; another extension would re-trigger penalty.",
      ].join("\n"),
      sections: null,
      model: "claude-sonnet-4-6",
      generated_at: "2026-05-15T13:00:12Z",
      failed: false,
      error: null,
    },
  ];
  return { rows, envConfigured, synthetic: true };
}

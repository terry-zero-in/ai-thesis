/**
 * Server-only loader for the /memos route.
 *
 * Pulls the most recent daily + weekly memos from the `memos` table.
 * `failed=true` rows are kept and surfaced so the operator sees WHY a
 * memo is missing instead of an unexplained gap.
 */
import { getSupabaseServer } from "./supabase/server";

export type MemoKind = "daily" | "weekly";

export interface MemoRow {
  id: string;
  kind: MemoKind;
  as_of: string;
  headline: string | null;
  body: string | null;
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
    .select("id,kind,as_of,headline,body,model,generated_at,failed,error")
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
      model: "claude-sonnet-4-6",
      generated_at: "2026-05-15T13:00:12Z",
      failed: false,
      error: null,
    },
  ];
  return { rows, envConfigured, synthetic: true };
}

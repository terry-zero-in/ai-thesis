/**
 * Server-only variant of `getLatestUniverseScores`. Lives in its own file
 * because it imports `next/headers` via `getSupabaseServer` — that import
 * is poison in client bundles, so it cannot live alongside the browser
 * variant in `universe-data.ts`.
 *
 * WHY THIS EXISTS:
 *   The dashboard is a server component that ultimately calls into
 *   `getLatestUniverseScores()`. The original implementation used the
 *   browser supabase client (anon key, no cookies → no user JWT). RLS
 *   policies on `scores_history` and `universe` block anon reads, so the
 *   server-rendered dashboard silently fell back to an empty snapshot
 *   — producing the cosmetic giveaway of uniform ±1.6 mover deltas.
 *
 * This server variant uses `getSupabaseServer()`, which threads the user
 * JWT through cookies, so RLS allows the read and real data flows.
 *
 * The browser variant in `universe-data.ts` is still correct for the
 * `/universe` client page (cookies live in the browser there).
 */
import { getSupabaseServer } from "./supabase/server";
import {
  buildSnapshot,
  emptySnapshot,
  type UniverseSnapshot,
  type UniverseDbRow,
  type ScoresRow,
} from "./universe-data";

export async function getLatestUniverseScoresServer(): Promise<UniverseSnapshot> {
  const sb = await getSupabaseServer();
  if (!sb) return emptySnapshot();

  // Parallelize the three independent queries so the RSC fetch isn't
  // serialized waiting for universe → scores → queue. Same pattern as the
  // browser variant in `universe-data.ts`.
  const [universeRes, scoresRes, queueRes] = await Promise.all([
    sb.from("universe").select("ticker,name,layer,layer_label").eq("is_active", true).order("ticker"),
    sb
      .from("scores_history")
      .select(
        "ticker,as_of,q_score,g_score,v_score,aiq_score,composite,final_score,tier,macro_gates_hit,macro_multiplier",
      )
      .order("as_of", { ascending: false })
      .limit(400),
    sb.from("aiq_draft_queue").select("ticker").in("status", ["queued", "processing"]),
  ]);

  const { data: universe, error: ue } = universeRes;
  const { data: scores, error: se } = scoresRes;
  const { data: queue } = queueRes; // queue errors are non-fatal — render scores without badges
  if (ue || !universe || universe.length === 0) return emptySnapshot();
  if (se || !scores || scores.length === 0) return emptySnapshot();

  const queuedTickers = (queue ?? []).map((r) => (r as { ticker: string }).ticker);
  return { ...buildSnapshot(universe as UniverseDbRow[], scores as ScoresRow[]), queuedTickers };
}

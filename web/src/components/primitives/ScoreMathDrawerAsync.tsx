import { getScoreMath } from "@/lib/score-math";
import { ScoreMathDrawer } from "./ScoreMathDrawer";
import type { ReactNode } from "react";

/**
 * Server-async wrapper that fetches the ScoreMathRow for a ticker
 * server-side and renders the client-side <ScoreMathDrawer />.
 *
 * Use this when the host page is a Server Component (e.g., name detail's
 * RSC parent). For client-only contexts that already have the row in
 * hand, render <ScoreMathDrawer /> directly.
 */
export async function ScoreMathDrawerAsync({
  ticker,
  trigger,
  ariaLabel,
}: {
  ticker: string;
  trigger: ReactNode;
  ariaLabel?: string;
}) {
  const row = await getScoreMath(ticker);
  return <ScoreMathDrawer row={row} trigger={trigger} ariaLabel={ariaLabel} />;
}

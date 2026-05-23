import { getEngineStatus } from "@/lib/engine-status";
import { getScoreMath } from "@/lib/score-math";
import { NameDetailClient } from "./NameDetailClient";

/**
 * Server wrapper for /universe/[ticker]. Resolves the dynamic param,
 * fetches engine-status + score-math derivation server-side (so the
 * sitewide strip AND the per-name Score Math Drawer are ISR-cached
 * with the rest of the page), and hands off to the client component
 * which owns the per-ticker interactive shell.
 *
 * Per-detail data (factor panels, sparkline, dep flags, form4) still
 * loads client-side via getNameDetail() — the client fetch was preserved
 * to keep the prev/next pager + ticker switch snappy without a full RSC
 * round-trip per ticker.
 */
interface Params {
  ticker: string;
}

export default async function NameDetailPage({ params }: { params: Promise<Params> }) {
  const { ticker } = await params;
  const [engineStatus, scoreMath] = await Promise.all([
    getEngineStatus(),
    getScoreMath(ticker),
  ]);
  return <NameDetailClient ticker={ticker} engineStatus={engineStatus} scoreMath={scoreMath} />;
}

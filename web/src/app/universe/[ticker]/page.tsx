import { getEngineStatus } from "@/lib/engine-status";
import { NameDetailClient } from "./NameDetailClient";

/**
 * Server wrapper for /universe/[ticker]. Resolves the dynamic param,
 * fetches engine-status server-side (so the sitewide strip is ISR-cached
 * with the rest of the page), and hands off to the client component
 * which owns the per-ticker data fetch + interactive shell.
 *
 * Per-detail data still loads client-side (see NameDetailClient) — the
 * client fetch was preserved to keep the prev/next pager + ticker switch
 * snappy without a full RSC round-trip per ticker.
 */
interface Params {
  ticker: string;
}

export default async function NameDetailPage({ params }: { params: Promise<Params> }) {
  const { ticker } = await params;
  const engineStatus = await getEngineStatus();
  return <NameDetailClient ticker={ticker} engineStatus={engineStatus} />;
}

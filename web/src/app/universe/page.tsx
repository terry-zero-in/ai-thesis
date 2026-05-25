import { getLatestUniverseScoresServer } from "@/lib/universe-data-server";
import { getEngineStatus } from "@/lib/engine-status";
import type { Tier } from "@/lib/universe-data";
import { UniverseClient } from "./UniverseClient";

/**
 * Revalidate every 30 min — same cadence as Dashboard/Regime. Scores
 * update on the Saturday composite chain; macro updates daily. 30 min
 * is the right floor without spamming the DB on weekday traffic.
 */
export const revalidate = 1800;

const VALID_TIERS: ReadonlySet<Tier> = new Set(["High", "Medium", "Low", "Avoid"]);

export default async function UniversePage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string | string[] }>;
}) {
  const [snap, engineStatus, sp] = await Promise.all([
    getLatestUniverseScoresServer(),
    getEngineStatus(),
    searchParams,
  ]);
  // ?tier=High lands the Universe pre-filtered to that tier. Dashboard's
  // High-tier KPI tile links here (THS-101 item 2). Validate against the
  // Tier union so a stray param can't seed a non-existent chip.
  const tierRaw = Array.isArray(sp.tier) ? sp.tier[0] : sp.tier;
  const initialTier = tierRaw && VALID_TIERS.has(tierRaw as Tier) ? (tierRaw as Tier) : null;
  return <UniverseClient snap={snap} engineStatus={engineStatus} initialTier={initialTier} />;
}

import { getLatestUniverseScoresServer } from "@/lib/universe-data-server";
import { getEngineStatus } from "@/lib/engine-status";
import { UniverseClient } from "./UniverseClient";

/**
 * Revalidate every 30 min — same cadence as Dashboard/Regime. Scores
 * update on the Saturday composite chain; macro updates daily. 30 min
 * is the right floor without spamming the DB on weekday traffic.
 */
export const revalidate = 1800;

export default async function UniversePage() {
  const [snap, engineStatus] = await Promise.all([
    getLatestUniverseScoresServer(),
    getEngineStatus(),
  ]);
  return <UniverseClient snap={snap} engineStatus={engineStatus} />;
}

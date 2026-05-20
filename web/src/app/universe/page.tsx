import { getLatestUniverseScoresServer } from "@/lib/universe-data-server";
import { UniverseClient } from "./UniverseClient";

/**
 * Revalidate every 30 min — same cadence as Dashboard/Regime. Scores
 * update on the Saturday composite chain; macro updates daily. 30 min
 * is the right floor without spamming the DB on weekday traffic.
 */
export const revalidate = 1800;

export default async function UniversePage() {
  const snap = await getLatestUniverseScoresServer();
  return <UniverseClient snap={snap} />;
}
